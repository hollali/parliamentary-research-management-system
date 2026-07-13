import { Router } from "express";
import prisma from "../lib/prisma.js";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import { sendEmail, assignmentEmail } from "../lib/email.js";
import { shouldNotify, shouldEmail } from "../lib/notifications.js";

const router = Router();

// List pending requests (admin)
router.get("/pending", authenticateToken, requireRole("ADMIN"), async (_req, res) => {
  try {
    const requests = await prisma.researchRequest.findMany({
      where: { status: "SUBMITTED" },
      include: {
        category: true,
        submitter: { select: { id: true, firstName: true, lastName: true, initials: true, title: true } },
      },
      orderBy: { dateSubmitted: "asc" },
    });
    res.json(requests);
  } catch (error) {
    console.error("List pending error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Assign research officer
router.post("/", authenticateToken, requireRole("ADMIN"), async (req, res) => {
  try {
    const { requestId, assignedToId, assignedToIds, teamId, deadline, notes } = req.body;

    if (!requestId || !deadline) {
      return res.status(400).json({ error: "requestId and deadline are required" });
    }

    if (new Date(deadline) <= new Date()) {
      return res.status(400).json({ error: "Deadline must be in the future" });
    }

    const officerIds: string[] = assignedToIds || (assignedToId ? [assignedToId] : []);

    if (officerIds.length === 0 && !teamId) {
      return res.status(400).json({ error: "At least one officer or a team is required" });
    }

    const request = await prisma.researchRequest.findUnique({ where: { id: requestId } });
    if (!request) return res.status(404).json({ error: "Request not found" });

    // Validate officers in a single batch query
    const officers = await prisma.user.findMany({
      where: { id: { in: officerIds }, role: "RESEARCH_OFFICER" },
    });
    if (officers.length !== officerIds.length) {
      const foundIds = new Set(officers.map(o => o.id));
      const invalid = officerIds.filter(id => !foundIds.has(id));
      return res.status(400).json({ error: `Invalid research officer: ${invalid.join(", ")}` });
    }

    let team: any = null;
    if (teamId) {
      team = await prisma.researchTeam.findUnique({ where: { id: teamId }, include: { members: true } });
      if (!team) return res.status(400).json({ error: "Invalid team" });
    }

    // Create assignments for each officer
    const assignments: any[] = [];
    for (const oid of officerIds) {
      const assignment = await prisma.assignment.create({
        data: {
          requestId,
          assignedById: req.user!.userId,
          assignedToId: oid,
          teamId: null,
          deadline: new Date(deadline),
          notes,
        },
        include: {
          assignedBy: { select: { id: true, firstName: true, lastName: true } },
          assignedTo: { select: { id: true, firstName: true, lastName: true } },
          team: { select: { id: true, name: true } },
        },
      });
      assignments.push(assignment);
    }

    // Create team assignment if applicable
    if (team) {
      const teamAssignment = await prisma.assignment.create({
        data: {
          requestId,
          assignedById: req.user!.userId,
          assignedToId: null,
          teamId: team.id,
          deadline: new Date(deadline),
          notes,
        },
        include: {
          assignedBy: { select: { id: true, firstName: true, lastName: true } },
          assignedTo: { select: { id: true, firstName: true, lastName: true } },
          team: { select: { id: true, name: true } },
        },
      });
      assignments.push(teamAssignment);
    }

    // Update request — set primary officer to the first officer or keep existing
    const primaryOfficerId = officerIds[0] || request.assignedOfficerId;
    const updatedRequest = await prisma.researchRequest.update({
      where: { id: requestId },
      data: {
        assignedOfficerId: primaryOfficerId || null,
        teamId: teamId || request.teamId || null,
        status: "ASSIGNED",
        dateAssigned: new Date(),
        deadline: new Date(deadline),
      },
    });

    // Notify each officer
    for (const officer of officers) {
      if (await shouldNotify(officer.id, 'newAssignments')) {
        await prisma.notification.create({
          data: {
            recipientId: officer.id,
            type: "REQUEST_ASSIGNED",
            title: "New Research Assignment",
            message: `You have been assigned: ${request.title}`,
            link: `/requests/${requestId}`,
          },
        });
      }
      if (await shouldEmail(officer.id)) {
        const email = assignmentEmail(officer.firstName, request.requestNumber, request.title, deadline);
        sendEmail({ to: officer.email, ...email }).catch(() => {});
      }
    }

    // Notify team members
    if (team) {
      for (const member of team.members) {
        if (await shouldNotify(member.userId, 'newAssignments')) {
          await prisma.notification.create({
            data: {
              recipientId: member.userId,
              type: "REQUEST_ASSIGNED",
              title: "New Team Research Assignment",
              message: `Team "${team.name}" has been assigned: ${request.title}`,
              link: `/requests/${requestId}`,
            },
          });
        }
      }
    }

    await prisma.activityLog.create({
      data: {
        authorId: req.user!.userId,
        action: "ASSIGNED",
        entityType: "ResearchRequest",
        entityId: requestId,
        description: team && officers.length === 0
          ? `Assigned to team "${team.name}"`
          : `Assigned to ${officers.map(o => `${o.firstName} ${o.lastName}`).join(', ')}`,
      },
    });

    res.json({ assignments, request: updatedRequest });
  } catch (error) {
    console.error("Assignment error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get available research officers
router.get("/officers", authenticateToken, requireRole("ADMIN"), async (_req, res) => {
  try {
    const officers = await prisma.user.findMany({
      where: { role: "RESEARCH_OFFICER", isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        initials: true,
        title: true,
        email: true,
        _count: { select: { assignedRequests: { where: { status: { in: ["ASSIGNED", "IN_PROGRESS"] } } } } },
      },
      orderBy: { firstName: "asc" },
    });
    res.json(officers);
  } catch (error) {
    console.error("Get officers error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Accept assignment
router.post("/:assignmentId/accept", authenticateToken, requireRole("RESEARCH_OFFICER"), async (req, res) => {
  try {
    const assignment = await prisma.assignment.findUnique({ where: { id: req.params.assignmentId } });
    if (!assignment) return res.status(404).json({ error: "Assignment not found" });
    if (assignment.assignedToId !== req.user!.userId) {
      return res.status(403).json({ error: "Not your assignment" });
    }

    const updated = await prisma.assignment.update({
      where: { id: req.params.assignmentId },
      data: { acceptedAt: new Date() },
      include: {
        assignedBy: { select: { firstName: true, lastName: true } },
        assignedTo: { select: { firstName: true, lastName: true } },
      },
    });

    await prisma.activityLog.create({
      data: {
        authorId: req.user!.userId,
        action: "STATUS_CHANGED",
        entityType: "Assignment",
        entityId: assignment.id,
        description: `Assignment accepted by ${req.user!.userId}`,
      },
    });

    // Notify the admin who assigned
    if (await shouldNotify(assignment.assignedById, 'statusChanges')) {
      await prisma.notification.create({
        data: {
          recipientId: assignment.assignedById,
          type: "GENERAL",
          title: "Assignment Accepted",
          message: `Assignment for request has been accepted`,
          link: `/requests/${assignment.requestId}`,
        },
      });
    }

    res.json(updated);
  } catch (error) {
    console.error("Accept assignment error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Decline assignment
router.post("/:assignmentId/decline", authenticateToken, requireRole("RESEARCH_OFFICER"), async (req, res) => {
  try {
    const { reason } = req.body;
    const assignment = await prisma.assignment.findUnique({ where: { id: req.params.assignmentId } });
    if (!assignment) return res.status(404).json({ error: "Assignment not found" });
    if (assignment.assignedToId !== req.user!.userId) {
      return res.status(403).json({ error: "Not your assignment" });
    }

    const updated = await prisma.assignment.update({
      where: { id: req.params.assignmentId },
      data: {
        declinedAt: new Date(),
        declineReason: reason || null,
      },
      include: {
        assignedBy: { select: { firstName: true, lastName: true } },
        assignedTo: { select: { firstName: true, lastName: true } },
      },
    });

    // Unassign and revert status
    await prisma.researchRequest.update({
      where: { id: assignment.requestId },
      data: { assignedOfficerId: null, status: "SUBMITTED" },
    });

    await prisma.activityLog.create({
      data: {
        authorId: req.user!.userId,
        action: "STATUS_CHANGED",
        entityType: "Assignment",
        entityId: assignment.id,
        description: `Assignment declined${reason ? `: ${reason}` : ''}`,
      },
    });

    // Notify the admin who assigned
    if (await shouldNotify(assignment.assignedById, 'statusChanges')) {
      await prisma.notification.create({
        data: {
          recipientId: assignment.assignedById,
          type: "GENERAL",
          title: "Assignment Declined",
          message: `An assignment has been declined${reason ? `: ${reason}` : ''}`,
          link: `/requests/${assignment.requestId}`,
        },
      });
    }

    res.json(updated);
  } catch (error) {
    console.error("Decline assignment error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
