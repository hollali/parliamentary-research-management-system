import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authenticateToken, requireRole } from "../middleware/auth";

const router = Router();

// List all active teams with members
router.get("/", authenticateToken, async (_req, res) => {
  try {
    const teams = await prisma.researchTeam.findMany({
      where: { isActive: true },
      include: {
        lead: { select: { id: true, firstName: true, lastName: true, initials: true } },
        members: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, initials: true, role: true, title: true } },
          },
        },
        _count: { select: { requests: true, assignments: true } },
      },
      orderBy: { name: "asc" },
    });
    res.json(teams);
  } catch (error) {
    console.error("Error fetching teams:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get single team with full details
router.get("/:teamId", authenticateToken, async (req, res) => {
  try {
    const team = await prisma.researchTeam.findUnique({
      where: { id: req.params.teamId },
      include: {
        lead: { select: { id: true, firstName: true, lastName: true, initials: true } },
        members: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, initials: true, role: true, title: true, email: true } },
          },
        },
        requests: {
          select: { id: true, requestNumber: true, title: true, status: true, priority: true, deadline: true },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });
    if (!team) return res.status(404).json({ error: "Team not found" });
    res.json(team);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create team
router.post("/", authenticateToken, requireRole("ADMIN", "SUPER_ADMIN"), async (req, res) => {
  try {
    const { name, description, leadId, memberIds } = req.body;
    if (!name) return res.status(400).json({ error: "Team name is required" });

    const team = await prisma.researchTeam.create({
      data: {
        name,
        description,
        leadId: leadId || req.user!.userId,
        members: memberIds?.length
          ? {
              create: memberIds.map((id: string) => ({ userId: id })),
            }
          : undefined,
      },
      include: {
        lead: { select: { id: true, firstName: true, lastName: true, initials: true } },
        members: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, initials: true, role: true } },
          },
        },
      },
    });

    await prisma.activityLog.create({
      data: {
        authorId: req.user!.userId,
        action: "CREATED",
        entityType: "ResearchTeam",
        entityId: team.id,
        description: `Created team "${name}"`,
      },
    });

    res.json(team);
  } catch (error) {
    console.error("Error creating team:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update team
router.put("/:teamId", authenticateToken, requireRole("ADMIN", "SUPER_ADMIN"), async (req, res) => {
  try {
    const { name, description, leadId } = req.body;
    const team = await prisma.researchTeam.update({
      where: { id: req.params.teamId },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(leadId && { leadId }),
      },
      include: {
        lead: { select: { id: true, firstName: true, lastName: true, initials: true } },
        members: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, initials: true, role: true } },
          },
        },
      },
    });
    res.json(team);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Add members to team
router.post("/:teamId/members", authenticateToken, requireRole("ADMIN", "SUPER_ADMIN"), async (req, res) => {
  try {
    const { userIds } = req.body;
    if (!userIds?.length) return res.status(400).json({ error: "userIds required" });

    await prisma.teamMember.createMany({
      data: userIds.map((userId: string) => ({ teamId: req.params.teamId, userId })),
      skipDuplicates: true,
    });

    const team = await prisma.researchTeam.findUnique({
      where: { id: req.params.teamId },
      include: {
        members: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, initials: true, role: true } },
          },
        },
      },
    });
    res.json(team);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Remove member from team
router.delete("/:teamId/members/:userId", authenticateToken, requireRole("ADMIN", "SUPER_ADMIN"), async (req, res) => {
  try {
    await prisma.teamMember.deleteMany({
      where: { teamId: req.params.teamId, userId: req.params.userId },
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Deactivate team
router.delete("/:teamId", authenticateToken, requireRole("ADMIN", "SUPER_ADMIN"), async (req, res) => {
  try {
    await prisma.researchTeam.update({
      where: { id: req.params.teamId },
      data: { isActive: false },
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
