import { Router } from "express";
import prisma from "../lib/prisma.js";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import { sendEmail, assignmentEmail } from "../lib/email.js";
import { shouldNotify, shouldEmail, createNotification } from "../lib/notifications.js";
import { logger } from "../lib/logger.js";

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
    logger.requestError("GET", "/pending", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

async function notifyOfficer(officer: { id: string; email: string; firstName: string }, request: { requestNumber: string; title: string; id: string }, deadline: string, type: "REQUEST_ASSIGNED" | "GENERAL", title: string, message: string) {
  if (await shouldNotify(officer.id, 'newAssignments')) {
    await createNotification({
      recipientId: officer.id,
      type,
      title,
      message,
      requestId: request.id,
    }, { dispatchEmail: false });
  }
  if (await shouldEmail(officer.id)) {
    const email = assignmentEmail(officer.firstName, request.requestNumber, request.title, deadline);
    sendEmail({ to: officer.email, ...email }).catch((err) => logger.requestError("POST", "/ (email)", err));
  }
}

async function notifyUnassigned(officer: { id: string; email: string; firstName: string }, request: { id: string; title: string; requestNumber: string }, replacement: string) {
  if (await shouldNotify(officer.id, 'statusChanges')) {
    await createNotification({
      recipientId: officer.id,
      type: "GENERAL",
      title: "Assignment Reassigned",
      message: `You have been replaced on "${request.title}" by ${replacement}`,
      requestId: request.id,
    }, { dispatchEmail: false });
  }
  if (await shouldEmail(officer.id)) {
    sendEmail({
      to: officer.email,
      subject: `Assignment reassigned: ${request.requestNumber}`,
      html: `<p>Dear ${officer.firstName},</p><p>You have been unassigned from research request <strong>${request.requestNumber}</strong> (${request.title}). The assignment now belongs to ${replacement}.</p>`,
    }).catch((err) => logger.requestError("POST", "/ (email)", err));
  }
}

const assignmentInclude = {
  assignedBy: { select: { id: true, firstName: true, lastName: true } },
  assignedTo: { select: { id: true, firstName: true, lastName: true } },
  team: { select: { id: true, name: true } },
} as const;

// Assign / Reassign / Add research officer(s)
router.post("/", authenticateToken, requireRole("ADMIN"), async (req, res) => {
  try {
    const { requestId, assignedToId, assignedToIds, teamId, deadline, notes, action = "assign" } = req.body;

    if (!["assign", "reassign", "add"].includes(action)) {
      return res.status(400).json({ error: "action must be one of: assign, reassign, add" });
    }

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

    // Reassignments target a single new officer OR a team (not both)
    if (action === "reassign") {
      const hasOfficer = officerIds.length === 1;
      const hasTeam = Boolean(teamId);
      if (hasOfficer === hasTeam) {
        return res.status(400).json({ error: "Reassignment requires exactly one new officer or a team" });
      }
    }

    // Add operates on individual officers, not teams
    if (action === "add" && teamId) {
      return res.status(400).json({ error: "Teams are only supported for the assign and reassign actions" });
    }

    const request = await prisma.researchRequest.findUnique({ where: { id: requestId } });
    if (!request) return res.status(404).json({ error: "Request not found" });

    if (action === "assign" && request.assignedOfficerId) {
      return res.status(400).json({ error: "Request is already assigned — use Reassign or Add Officer" });
    }
    if (action === "reassign" && !request.assignedOfficerId && !request.teamId) {
      return res.status(400).json({ error: "Reassignment requires a currently assigned officer or team" });
    }

    // Validate officers in a single batch query
    const officers = await prisma.user.findMany({
      where: { id: { in: officerIds }, role: { in: ["RESEARCH_OFFICER"] } },
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

    const newDeadline = new Date(deadline);

    // ─── REASSIGN: replace the previous primary officer or team ────────
    if (action === "reassign") {
      const previousOfficerId = request.assignedOfficerId;

      // Reassign to a team
      if (teamId) {
        // Collect every currently active assignee so they can be notified
        const previousAssignees = await prisma.assignment.findMany({
          where: { requestId, declinedAt: null, supersededAt: null },
          select: { assignedToId: true },
        });

        // Supersede every outstanding assignment for this request
        await prisma.assignment.updateMany({
          where: { requestId, declinedAt: null, supersededAt: null },
          data: {
            supersededAt: new Date(),
            declineReason: `Reassigned to team "${team.name}"`,
          },
        });

        // Create the new assignment for the incoming team
        const assignment = await prisma.assignment.create({
          data: {
            requestId,
            assignedById: req.user!.userId,
            assignedToId: null,
            teamId: team.id,
            deadline: newDeadline,
            notes,
          },
          include: assignmentInclude,
        });

        const updatedRequest = await prisma.researchRequest.update({
          where: { id: requestId },
          data: {
            assignedOfficerId: null,
            teamId: team.id,
            status: "ASSIGNED",
            dateAssigned: new Date(),
            deadline: newDeadline,
          },
        });

        // Notify team members
        for (const member of team.members) {
          if (await shouldNotify(member.userId, 'newAssignments')) {
            await createNotification({
              recipientId: member.userId,
              type: "REQUEST_ASSIGNED",
              title: "New Team Research Assignment",
              message: `Team "${team.name}" has been assigned: ${request.title}`,
              requestId,
            });
          }
        }

        // Notify every previously assigned officer that they were unassigned
        const previousOfficerIds = [...new Set(previousAssignees.map(a => a.assignedToId).filter((id): id is string => Boolean(id)))];
        for (const officerId of previousOfficerIds) {
          const previousOfficer = await prisma.user.findUnique({
            where: { id: officerId },
            select: { id: true, email: true, firstName: true },
          });
          if (previousOfficer) {
            await notifyUnassigned(previousOfficer, request, `team "${team.name}"`);
          }
        }

        await prisma.activityLog.create({
          data: {
            authorId: req.user!.userId,
            action: "REASSIGNED",
            entityType: "ResearchRequest",
            entityId: requestId,
            description: `Reassigned from ${previousOfficerId ? "previous officer" : "previous team"} to team "${team.name}"`,
            metadata: { previousOfficerId, newTeamId: team.id },
          },
        });

        return res.json({ assignments: [assignment], request: updatedRequest });
      }

      // Reassign to a single officer
      const newOfficer = officers[0];

      if (previousOfficerId === newOfficer.id) {
        return res.status(400).json({ error: "This officer is already assigned to the request" });
      }

      // Collect every currently active assignee so they can be notified
      const previousAssignees = await prisma.assignment.findMany({
        where: { requestId, declinedAt: null, supersededAt: null },
        select: { assignedToId: true },
      });

      // Supersede every outstanding assignment for this request
      await prisma.assignment.updateMany({
        where: { requestId, declinedAt: null, supersededAt: null },
        data: {
          supersededAt: new Date(),
          declineReason: `Reassigned to ${newOfficer.firstName} ${newOfficer.lastName}`,
        },
      });

      // Create the new assignment for the incoming officer
      const assignment = await prisma.assignment.create({
        data: {
          requestId,
          assignedById: req.user!.userId,
          assignedToId: newOfficer.id,
          teamId: null,
          deadline: newDeadline,
          notes,
        },
        include: assignmentInclude,
      });

      const updatedRequest = await prisma.researchRequest.update({
        where: { id: requestId },
        data: {
          assignedOfficerId: newOfficer.id,
          teamId: null,
          status: "ASSIGNED",
          dateAssigned: new Date(),
          deadline: newDeadline,
        },
      });

      // Notify the incoming officer
      await notifyOfficer(
        newOfficer,
        request,
        deadline,
        "REQUEST_ASSIGNED",
        "New Research Assignment",
        `You have been assigned: ${request.title}`,
      );

      // Notify every previously assigned officer that they were unassigned
      const previousOfficerIds = [...new Set(previousAssignees.map(a => a.assignedToId).filter((id): id is string => Boolean(id)))];
      for (const officerId of previousOfficerIds) {
        if (officerId === newOfficer.id) continue;
        const previousOfficer = await prisma.user.findUnique({
          where: { id: officerId },
          select: { id: true, email: true, firstName: true },
        });
        if (previousOfficer) {
          await notifyUnassigned(previousOfficer, request, `${newOfficer.firstName} ${newOfficer.lastName}`);
        }
      }

      await prisma.activityLog.create({
        data: {
          authorId: req.user!.userId,
          action: "REASSIGNED",
          entityType: "ResearchRequest",
          entityId: requestId,
          description: `Reassigned from ${previousOfficerId ? "previous officer" : "previous team"} to ${newOfficer.firstName} ${newOfficer.lastName}`,
          metadata: { previousOfficerId, newOfficerId: newOfficer.id },
        },
      });

      return res.json({ assignments: [assignment], request: updatedRequest });
    }

    // ─── ADD: keep existing officer(s) and append new ones ──────────────
    if (action === "add") {
      // Exclude officers already assigned to this request
      const existingAssignments = await prisma.assignment.findMany({
        where: { requestId, assignedToId: { in: officerIds }, declinedAt: null, supersededAt: null },
        select: { assignedToId: true },
      });
      const alreadyAssigned = new Set(existingAssignments.map(a => a.assignedToId));
      const newOfficers = officers.filter(o => !alreadyAssigned.has(o.id) && o.id !== request.assignedOfficerId);

      if (newOfficers.length === 0) {
        return res.status(400).json({ error: "Selected officers are already assigned to this request" });
      }

      const assignments: any[] = [];
      for (const officer of newOfficers) {
        const assignment = await prisma.assignment.create({
          data: {
            requestId,
            assignedById: req.user!.userId,
            assignedToId: officer.id,
            teamId: null,
            deadline: newDeadline,
            notes,
          },
          include: assignmentInclude,
        });
        assignments.push(assignment);
      }

      // Preserve the existing primary officer unless the request had none
      const primaryOfficerId = request.assignedOfficerId || newOfficers[0].id;
      const updatedRequest = await prisma.researchRequest.update({
        where: { id: requestId },
        data: {
          assignedOfficerId: primaryOfficerId,
          status: "ASSIGNED",
          dateAssigned: new Date(),
          deadline: newDeadline,
        },
      });

      for (const officer of newOfficers) {
        await notifyOfficer(
          officer,
          request,
          deadline,
          "REQUEST_ASSIGNED",
          "New Research Assignment",
          `You have been assigned: ${request.title}`,
        );
      }

      await prisma.activityLog.create({
        data: {
          authorId: req.user!.userId,
          action: "ASSIGNED",
          entityType: "ResearchRequest",
          entityId: requestId,
          description: `Added ${newOfficers.map(o => `${o.firstName} ${o.lastName}`).join(', ')} to request`,
        },
      });

      return res.json({ assignments, request: updatedRequest });
    }

    // ─── ASSIGN: initial assignment (existing behavior) ──────────────────
    // Create assignments for each officer
    const assignments: any[] = [];
    for (const oid of officerIds) {
      const assignment = await prisma.assignment.create({
        data: {
          requestId,
          assignedById: req.user!.userId,
          assignedToId: oid,
          teamId: null,
          deadline: newDeadline,
          notes,
        },
        include: assignmentInclude,
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
          deadline: newDeadline,
          notes,
        },
        include: assignmentInclude,
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
        deadline: newDeadline,
      },
    });

    // Notify each officer
    for (const officer of officers) {
      await notifyOfficer(
        officer,
        request,
        deadline,
        "REQUEST_ASSIGNED",
        "New Research Assignment",
        `You have been assigned: ${request.title}`,
      );
    }

    // Notify team members
    if (team) {
      for (const member of team.members) {
        if (await shouldNotify(member.userId, 'newAssignments')) {
          await createNotification({
            recipientId: member.userId,
            type: "REQUEST_ASSIGNED",
            title: "New Team Research Assignment",
            message: `Team "${team.name}" has been assigned: ${request.title}`,
            requestId,
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
    logger.requestError("POST", "/", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get available research officers
router.get("/officers", authenticateToken, requireRole("ADMIN"), async (_req, res) => {
  try {
    const officers = await prisma.user.findMany({
      where: { role: { in: ["RESEARCH_OFFICER"] }, isActive: true },
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
    logger.requestError("GET", "/officers", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get my assignments (officer)
router.get("/mine", authenticateToken, requireRole("RESEARCH_OFFICER"), async (req, res) => {
  try {
    const assignments = await prisma.assignment.findMany({
      where: {
        OR: [
          { assignedToId: req.user!.userId },
          { team: { members: { some: { userId: req.user!.userId } } } },
        ],
      },
      include: {
        request: {
          include: {
            category: true,
            submitter: { select: { id: true, firstName: true, lastName: true, initials: true, title: true } },
          },
        },
        assignedBy: { select: { firstName: true, lastName: true } },
        team: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(assignments);
  } catch (error) {
    logger.requestError("GET", "/mine", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Accept assignment
router.post("/:assignmentId/accept", authenticateToken, requireRole("RESEARCH_OFFICER"), async (req, res) => {
  try {
    const assignment = await prisma.assignment.findUnique({ where: { id: req.params.assignmentId } });
    if (!assignment) return res.status(404).json({ error: "Assignment not found" });
    if (assignment.assignedToId !== req.user!.userId) {
      // Allow members of an assigned team to accept the team assignment
      if (!assignment.teamId) return res.status(403).json({ error: "Not your assignment" });
      const membership = await prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId: assignment.teamId, userId: req.user!.userId } },
      });
      if (!membership) return res.status(403).json({ error: "Not your assignment" });
    }

    const [updated] = await prisma.$transaction([
      prisma.assignment.update({
        where: { id: req.params.assignmentId },
        data: { acceptedAt: new Date() },
        include: {
          assignedBy: { select: { firstName: true, lastName: true } },
          assignedTo: { select: { firstName: true, lastName: true } },
        },
      }),
      prisma.researchRequest.update({
        where: { id: assignment.requestId },
        data: { status: "IN_PROGRESS" },
      }),
    ]);

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
      await createNotification({
        recipientId: assignment.assignedById,
        type: "GENERAL",
        title: "Assignment Accepted",
        message: `Assignment for request has been accepted`,
        requestId: assignment.requestId,
      });
    }

    res.json(updated);
  } catch (error) {
    logger.requestError("POST", "/:assignmentId/accept", error);
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
      // Allow members of an assigned team to decline the team assignment
      if (!assignment.teamId) return res.status(403).json({ error: "Not your assignment" });
      const membership = await prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId: assignment.teamId, userId: req.user!.userId } },
      });
      if (!membership) return res.status(403).json({ error: "Not your assignment" });
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
      await createNotification({
        recipientId: assignment.assignedById,
        type: "GENERAL",
        title: "Assignment Declined",
        message: `An assignment has been declined${reason ? `: ${reason}` : ''}`,
        requestId: assignment.requestId,
      });
    }

    res.json(updated);
  } catch (error) {
    logger.requestError("POST", "/:assignmentId/decline", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
