import { Router } from "express";
import prisma from "../lib/prisma.js";
import { authenticateToken, requireRole } from "../middleware/auth.js";

const router = Router();

router.get("/", authenticateToken, async (req, res) => {
  try {
    const { role, userId } = req.user!;
    const now = new Date();

    // Base where clause depending on role
    const baseWhere: any = {};
    if (role === "MP") baseWhere.submitterId = userId;
    if (role === "RESEARCH_OFFICER") baseWhere.assignedOfficerId = userId;

    const [
      totalRequests,
      pendingRequests,
      inProgressRequests,
      completedRequests,
      overdueRequests,
      unreadNotifications,
    ] = await Promise.all([
      prisma.researchRequest.count({ where: baseWhere }),
      prisma.researchRequest.count({ where: { ...baseWhere, status: { in: ["SUBMITTED", "ASSIGNED"] } } }),
      prisma.researchRequest.count({ where: { ...baseWhere, status: { in: ["IN_PROGRESS", "DRAFT_SUBMITTED", "REVISION_REQUESTED", "REVISED"] } } }),
      prisma.researchRequest.count({ where: { ...baseWhere, status: { in: ["APPROVED", "DELIVERED", "CLOSED"] } } }),
      prisma.researchRequest.count({ where: { ...baseWhere, deadline: { lt: now }, status: { in: ["SUBMITTED", "ASSIGNED", "IN_PROGRESS", "DRAFT_SUBMITTED", "REVISION_REQUESTED", "REVISED"] } } }),
      prisma.notification.count({ where: { recipientId: userId, isRead: false } }),
    ]);

    // Recent activity
    const recentActivity = await prisma.activityLog.findMany({
      where: baseWhere.authorId ? { authorId: baseWhere.authorId } : {},
      include: { author: { select: { id: true, firstName: true, lastName: true, initials: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    // Upcoming deadlines
    const upcomingDeadlines = await prisma.researchRequest.findMany({
      where: {
        ...baseWhere,
        deadline: { gte: now },
        status: { in: ["ASSIGNED", "IN_PROGRESS", "DRAFT_SUBMITTED", "REVISION_REQUESTED"] },
      },
      select: {
        id: true,
        requestNumber: true,
        title: true,
        deadline: true,
        status: true,
        priority: true,
      },
      orderBy: { deadline: "asc" },
      take: 5,
    });

    res.json({
      stats: {
        totalRequests,
        pendingRequests,
        inProgressRequests,
        completedRequests,
        overdueRequests,
        unreadNotifications,
      },
      recentActivity,
      upcomingDeadlines,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Analytics endpoint (admin only)
router.get("/analytics", authenticateToken, async (req, res) => {
  try {
    const { role } = req.user!;
    if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      requestsByStatus,
      requestsByCategory,
      requestsByPriority,
      newRequestsLast30Days,
      officersWorkload,
    ] = await Promise.all([
      prisma.researchRequest.groupBy({ by: ["status"], _count: true }),
      prisma.researchRequest.groupBy({ by: ["categoryId"], _count: true, where: { categoryId: { not: null } } }),
      prisma.researchRequest.groupBy({ by: ["priority"], _count: true }),
      prisma.researchRequest.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.user.findMany({
        where: { role: "RESEARCH_OFFICER", isActive: true },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          initials: true,
          _count: {
            select: {
              assignedRequests: {
                where: { status: { in: ["ASSIGNED", "IN_PROGRESS", "DRAFT_SUBMITTED", "REVISION_REQUESTED"] } },
              },
              authoredReports: true,
            },
          },
        },
      }),
    ]);

    res.json({
      requestsByStatus,
      requestsByCategory,
      requestsByPriority,
      newRequestsLast30Days,
      officersWorkload,
    });
  } catch (error) {
    console.error("Analytics error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Activity audit log
router.get("/activity", authenticateToken, async (req, res) => {
  try {
    const { role, userId } = req.user!;
    const { action, entityType, page = "1", limit = "50" } = req.query;

    const where: any = {};
    if (role === "MP") where.authorId = userId;
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        include: {
          author: { select: { id: true, firstName: true, lastName: true, initials: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: parseInt(limit as string),
      }),
      prisma.activityLog.count({ where }),
    ]);

    res.json({ logs, total, page: parseInt(page as string), totalPages: Math.ceil(total / parseInt(limit as string)) });
  } catch (error) {
    console.error("Activity log error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Officer workload balancing stats
router.get("/workload", authenticateToken, requireRole("ADMIN", "SUPER_ADMIN"), async (_req, res) => {
  try {
    const officers = await prisma.user.findMany({
      where: { role: "RESEARCH_OFFICER", isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        initials: true,
        _count: {
          select: {
            assignedRequests: {
              where: { status: { in: ["ASSIGNED", "IN_PROGRESS", "DRAFT_SUBMITTED", "REVISION_REQUESTED", "REVISED"] } },
            },
          },
        },
      },
      orderBy: { firstName: "asc" },
    });

    const enriched = officers.map((o) => ({
      ...o,
      activeCount: o._count.assignedRequests,
      capacity: 10,
      utilization: Math.round((o._count.assignedRequests / 10) * 100),
      status: o._count.assignedRequests >= 10 ? "at_capacity" : o._count.assignedRequests >= 7 ? "high" : o._count.assignedRequests >= 4 ? "moderate" : "available",
    }));

    res.json({
      officers: enriched,
      summary: {
        totalOfficers: enriched.length,
        totalActive: enriched.reduce((sum, o) => sum + o.activeCount, 0),
        atCapacity: enriched.filter((o) => o.status === "at_capacity").length,
        available: enriched.filter((o) => o.status === "available").length,
      },
    });
  } catch (error) {
    console.error("Workload error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
