import { Router } from "express";
import prisma from "../lib/prisma.js";
import { authenticateToken, requireRole } from "../middleware/auth.js";

const router = Router();

function generateRequestNumber(): string {
  const year = new Date().getFullYear();
  const seq = Math.floor(Math.random() * 9000 + 1000);
  return `REQ-${year}-${seq}`;
}

function lookupByIdOrNumber(idOrNumber: string): any {
  return idOrNumber.startsWith('REQ-')
    ? { requestNumber: idOrNumber }
    : { id: idOrNumber };
}

// List requests (filtered by role)
router.get("/", authenticateToken, async (req, res) => {
  try {
    const { role, userId } = req.user!;
    const { status, priority, categoryId, search, page = "1", limit = "20" } = req.query;

    const where: any = {};

    if (role === "MP") {
      where.submitterId = userId;
    } else if (role === "RESEARCH_OFFICER") {
      where.OR = [
        { assignedOfficerId: userId },
        { assignments: { some: { assignedToId: userId } } },
        { team: { members: { some: { userId } } } },
      ];
    }

    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (categoryId) where.categoryId = categoryId;
    if (search) {
      const searchFilter = {
        OR: [
          { title: { contains: search as string, mode: "insensitive" } },
          { requestNumber: { contains: search as string, mode: "insensitive" } },
          { description: { contains: search as string, mode: "insensitive" } },
        ],
      };
      // Combine role filter with search using AND to preserve access control
      if (where.OR) {
        where.AND = [{ OR: where.OR }, searchFilter];
        delete where.OR;
      } else {
        where.OR = searchFilter.OR;
      }
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [requests, total] = await Promise.all([
      prisma.researchRequest.findMany({
        where,
        include: {
          category: true,
          submitter: { select: { id: true, firstName: true, lastName: true, initials: true, title: true } },
          officer: { select: { id: true, firstName: true, lastName: true, initials: true, title: true } },
          team: { select: { id: true, name: true } },
          assignments: {
            include: {
              assignedTo: { select: { id: true, firstName: true, lastName: true, initials: true } },
            },
          },
          _count: { select: { reports: true, comments: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: parseInt(limit as string),
      }),
      prisma.researchRequest.count({ where }),
    ]);

    res.json({ requests, total, page: parseInt(page as string), totalPages: Math.ceil(total / parseInt(limit as string)) });
  } catch (error) {
    console.error("List requests error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get single request
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const request = await prisma.researchRequest.findUnique({
      where: lookupByIdOrNumber(req.params.id),
      include: {
        category: true,
        submitter: { select: { id: true, firstName: true, lastName: true, initials: true, title: true, email: true } },
        officer: { select: { id: true, firstName: true, lastName: true, initials: true, title: true, email: true } },
        reports: {
          include: {
            author: { select: { id: true, firstName: true, lastName: true, initials: true } },
            versions: { orderBy: { version: "desc" } },
          },
          orderBy: { createdAt: "desc" },
        },
        comments: {
          include: { author: { select: { id: true, firstName: true, lastName: true, initials: true, title: true } } },
          orderBy: { createdAt: "desc" },
        },
        attachments: {
          include: { uploader: { select: { id: true, firstName: true, lastName: true } } },
        },
        assignments: {
          include: {
            assignedBy: { select: { id: true, firstName: true, lastName: true } },
            assignedTo: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    res.json(request);
  } catch (error) {
    console.error("Get request error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create request
router.post("/", authenticateToken, async (req, res) => {
  try {
    const { title, subject, description, scope, keyStakeholders, dataSources, language, priority, deadline, categoryId, attachments } = req.body;

    if (!title || !description || !deadline) {
      return res.status(400).json({ error: "Title, description, and deadline are required" });
    }

    const request = await prisma.researchRequest.create({
      data: {
        requestNumber: generateRequestNumber(),
        title,
        subject,
        description,
        scope,
        keyStakeholders,
        dataSources,
        language: language || "English",
        priority: priority || "STANDARD",
        deadline: new Date(deadline),
        submitterId: req.user!.userId,
        categoryId,
      },
      include: {
        category: true,
        submitter: { select: { id: true, firstName: true, lastName: true, initials: true } },
      },
    });

    await prisma.activityLog.create({
      data: {
        authorId: req.user!.userId,
        action: "CREATED",
        entityType: "ResearchRequest",
        entityId: request.id,
        description: `Research request "${title}" submitted`,
      },
    });

    res.status(201).json(request);
  } catch (error) {
    console.error("Create request error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update request
router.put("/:id", authenticateToken, async (req, res) => {
  try {
    const { title, subject, description, scope, keyStakeholders, dataSources, language, priority, deadline, categoryId, status } = req.body;

    const existing = await prisma.researchRequest.findUnique({ where: lookupByIdOrNumber(req.params.id) });
    if (!existing) {
      return res.status(404).json({ error: "Request not found" });
    }

    // Authorization: only the submitter, assigned officer, or admin can update
    const { role, userId } = req.user!;
    const isSubmitter = existing.submitterId === userId;
    const isOfficer = existing.assignedOfficerId === userId;
    const isAdmin = role === "ADMIN";
    if (!isSubmitter && !isOfficer && !isAdmin) {
      return res.status(403).json({ error: "Access denied" });
    }

    // MPs can only update their own request metadata, not status
    if (role === "MP" && status && status !== existing.status) {
      return res.status(403).json({ error: "Cannot change status" });
    }

    const updated = await prisma.researchRequest.update({
      where: { id: existing.id },
      data: {
        ...(title && { title }),
        ...(subject !== undefined && { subject }),
        ...(description && { description }),
        ...(scope !== undefined && { scope }),
        ...(keyStakeholders !== undefined && { keyStakeholders }),
        ...(dataSources !== undefined && { dataSources }),
        ...(language && { language }),
        ...(priority && { priority }),
        ...(deadline && { deadline: new Date(deadline) }),
        ...(categoryId !== undefined && { categoryId }),
        ...(status && { status }),
      },
      include: { category: true, submitter: { select: { id: true, firstName: true, lastName: true, initials: true } } },
    });

    await prisma.activityLog.create({
      data: {
        authorId: req.user!.userId,
        action: "UPDATED",
        entityType: "ResearchRequest",
        entityId: updated.id,
        description: `Research request updated`,
        metadata: { changes: req.body },
      },
    });

    res.json(updated);
  } catch (error) {
    console.error("Update request error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Cancel request
router.post("/:id/cancel", authenticateToken, async (req, res) => {
  try {
    const request = await prisma.researchRequest.findUnique({ where: lookupByIdOrNumber(req.params.id) });
    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    // Authorization: only the submitter or admin can cancel
    const { role, userId } = req.user!;
    const isSubmitter = request.submitterId === userId;
    const isAdmin = role === "ADMIN";
    if (!isSubmitter && !isAdmin) {
      return res.status(403).json({ error: "Access denied" });
    }

    const updated = await prisma.researchRequest.update({
      where: { id: request.id },
      data: { status: "CLOSED", dateClosed: new Date() },
    });

    await prisma.activityLog.create({
      data: {
        authorId: req.user!.userId,
        action: "STATUS_CHANGED",
        entityType: "ResearchRequest",
        entityId: request.id,
        description: `Request cancelled/closed`,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error("Cancel request error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get committees
router.get("/meta/committees", authenticateToken, async (_req, res) => {
  try {
    const committees = await prisma.committee.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
    res.json(committees);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get committee stats (request counts by status per committee)
router.get("/meta/committees/stats", authenticateToken, async (_req, res) => {
  try {
    const stats = await prisma.committee.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        shortName: true,
        committeeType: true,
        chairperson: true,
        clerk: true,
        _count: { select: { requests: true } },
      },
      orderBy: { name: "asc" },
    });

    const statusCounts = await prisma.researchRequest.groupBy({
      by: ["categoryId", "status"],
      _count: true,
      where: { categoryId: { not: null } },
    });

    const result = stats.map((s) => {
      const statuses = statusCounts
        .filter((sc) => sc.categoryId === s.id)
        .reduce((acc, sc) => {
          acc[sc.status] = sc._count;
          return acc;
        }, {} as Record<string, number>);

      return { ...s, statuses, total: s._count.requests };
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get requests for a specific committee
router.get("/committee/:committeeId", authenticateToken, async (req, res) => {
  try {
    const { committeeId } = req.params;
    const requests = await prisma.researchRequest.findMany({
      where: { categoryId: committeeId },
      include: {
        category: true,
        submitter: { select: { id: true, firstName: true, lastName: true, initials: true, title: true } },
        officer: { select: { id: true, firstName: true, lastName: true, initials: true, title: true } },
        _count: { select: { reports: true, comments: true, attachments: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Cross-Committee Sharing ─────────────────────────────

// Global search
router.get("/search/global", authenticateToken, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || String(q).length < 2) {
      return res.json({ requests: [], users: [], reports: [] });
    }
    const query = String(q);
    const mode = { contains: query, mode: "insensitive" as const };

    const [requests, users, reports] = await Promise.all([
      prisma.researchRequest.findMany({
        where: {
          OR: [
            { title: mode },
            { subject: mode },
            { requestNumber: mode },
            { description: mode },
          ],
        },
        select: {
          id: true,
          requestNumber: true,
          title: true,
          status: true,
          priority: true,
          deadline: true,
          submitter: { select: { firstName: true, lastName: true } },
        },
        take: 20,
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.findMany({
        where: {
          OR: [
            { firstName: mode },
            { lastName: mode },
            { email: mode },
          ],
          isActive: true,
        },
        select: { id: true, firstName: true, lastName: true, role: true, initials: true },
        take: 10,
      }),
      prisma.researchReport.findMany({
        where: {
          OR: [
            { title: mode },
            { content: mode },
          ],
        },
        select: {
          id: true,
          title: true,
          version: true,
          createdAt: true,
          request: { select: { id: true, requestNumber: true, title: true } },
        },
        take: 10,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    res.json({ requests, users, reports });
  } catch (error) {
    console.error("Global search error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Share a request with another committee
router.post("/:requestId/share", authenticateToken, requireRole("ADMIN"), async (req, res) => {
  try {
    const { committeeId, notes } = req.body;
    if (!committeeId) {
      return res.status(400).json({ error: "committeeId is required" });
    }

    const existing = await prisma.sharedResearch.findUnique({
      where: { requestId_sharedWithId: { requestId: req.params.requestId, sharedWithId: committeeId } },
    });
    if (existing) {
      return res.status(409).json({ error: "Already shared with this committee" });
    }

    const shared = await prisma.sharedResearch.create({
      data: {
        requestId: req.params.requestId,
        sharedWithId: committeeId,
        sharedById: req.user!.userId,
        notes,
      },
      include: {
        sharedWith: { select: { id: true, name: true, shortName: true } },
        sharedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await prisma.activityLog.create({
      data: {
        authorId: req.user!.userId,
        action: "UPDATED",
        entityType: "ResearchRequest",
        entityId: req.params.requestId,
        description: `Request shared with committee ${shared.sharedWith.shortName || shared.sharedWith.name}`,
      },
    });

    res.status(201).json(shared);
  } catch (error) {
    console.error("Share request error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get committees a request is shared with
router.get("/:requestId/shared", authenticateToken, async (req, res) => {
  try {
    const shares = await prisma.sharedResearch.findMany({
      where: { requestId: req.params.requestId },
      include: {
        sharedWith: { select: { id: true, name: true, shortName: true, committeeType: true } },
        sharedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(shares);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get all requests shared with a specific committee
router.get("/shared/committee/:committeeId", authenticateToken, async (req, res) => {
  try {
    const shares = await prisma.sharedResearch.findMany({
      where: { sharedWithId: req.params.committeeId },
      include: {
        request: {
          select: {
            id: true, requestNumber: true, title: true, status: true, priority: true, deadline: true, createdAt: true,
            submitter: { select: { firstName: true, lastName: true } },
          },
        },
        sharedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(shares);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
