import { Router } from "express";
import prisma from "../lib/prisma.js";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import { logger } from "../lib/logger.js";
import type { RequestStatus } from "../../src/generated/prisma/enums.js";

const router = Router();

const startOfTodayUtc = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

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
    logger.requestError("GET", "/", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Analytics endpoint (admin only)
router.get("/analytics", authenticateToken, async (req, res) => {
  try {
    const { role } = req.user!;
    if (role !== "ADMIN") {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const ACTIVE_STATUSES: RequestStatus[] = ["SUBMITTED", "ASSIGNED", "IN_PROGRESS", "DRAFT_SUBMITTED", "REVISION_REQUESTED", "REVISED"];
    const COMPLETED_STATUSES: RequestStatus[] = ["APPROVED", "DELIVERED", "CLOSED"];

    const [
      requestsByStatus,
      requestsByPriority,
      committees,
      newRequestsLast7Days,
      newRequestsLast30Days,
      totalRequests,
      completedRequests,
      activeRequests,
      overdueRequests,
      officersWorkload,
      avgCompletionDays,
    ] = await Promise.all([
      prisma.researchRequest.groupBy({ by: ["status"], _count: true }),
      prisma.researchRequest.groupBy({ by: ["priority"], _count: true }),
      prisma.committee.findMany({
        select: {
          id: true,
          name: true,
          shortName: true,
          _count: { select: { requests: true } },
        },
        orderBy: { name: "asc" },
      }),
      prisma.researchRequest.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.researchRequest.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.researchRequest.count(),
      prisma.researchRequest.count({ where: { status: { in: COMPLETED_STATUSES } } }),
      prisma.researchRequest.count({ where: { status: { in: ACTIVE_STATUSES } } }),
      prisma.researchRequest.count({ where: { deadline: { lt: now }, status: { in: ACTIVE_STATUSES } } }),
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
                where: { status: { in: ACTIVE_STATUSES } },
              },
              authoredReports: true,
            },
          },
        },
        orderBy: [{ initials: "asc" }],
      }),
      prisma.$queryRaw<Array<{ avgDays: number | null }>>`
        SELECT AVG(EXTRACT(EPOCH FROM (COALESCE("dateCompleted", "createdAt") - COALESCE("dateSubmitted", "createdAt"))) / 86400.0) AS "avgDays"
        FROM "research_requests"
        WHERE "status" IN ('APPROVED','DELIVERED','CLOSED') AND "dateCompleted" IS NOT NULL
      `,
    ]);

    // Category breakdown by committee (with an "Uncategorized" bucket for unassigned requests)
    const withCommittee = await prisma.researchRequest.count({ where: { committeeId: { not: null } } });
    const requestsByCategory = committees
      .filter((c) => c._count.requests > 0)
      .map((c) => ({ id: c.id, name: c.shortName || c.name, count: c._count.requests }))
      .sort((a, b) => b.count - a.count);
    if (totalRequests - withCommittee > 0) {
      requestsByCategory.push({ id: "uncategorized", name: "Uncategorized", count: totalRequests - withCommittee });
    }

    res.json({
      requestsByStatus,
      requestsByCategory,
      requestsByPriority,
      newRequestsLast7Days,
      newRequestsLast30Days,
      totalRequests,
      completedRequests,
      activeRequests,
      overdueRequests,
      completionRate: totalRequests > 0 ? Math.round((completedRequests / totalRequests) * 100) : 0,
      avgCompletionDays: Math.round((avgCompletionDays[0]?.avgDays || 0) * 10) / 10,
      officersWorkload,
    });
  } catch (error) {
    logger.requestError("GET", "/analytics", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Activity audit log
router.get("/activity", authenticateToken, async (req, res) => {
  try {
    const { role, userId } = req.user!;
    const { action, entityType, page: rawPage = "1", limit: rawLimit = "50" } = req.query;
    const p = Math.max(1, parseInt(rawPage as string) || 1);
    const l = Math.min(100, Math.max(1, parseInt(rawLimit as string) || 50));
    const skip = (p - 1) * l;

    const where: any = {};
    if (role === "MP") where.authorId = userId;
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;

    const [logs, total, today, actorGroups, actionGroups] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        include: {
          author: { select: { id: true, firstName: true, lastName: true, initials: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: l,
      }),
      prisma.activityLog.count({ where }),
      prisma.activityLog.count({
        where: { ...where, createdAt: { gte: startOfTodayUtc() } },
      }),
      prisma.activityLog.groupBy({ by: ["authorId"], where }),
      prisma.activityLog.groupBy({ by: ["action"], where, _count: { _all: true } }),
    ]);

    res.json({
      logs,
      total,
      page: p,
      totalPages: Math.ceil(total / l),
      summary: {
        today,
        uniqueActors: actorGroups.filter((a) => a.authorId).length,
        actions: actionGroups.map((g) => ({ action: g.action, count: g._count._all })).sort((a, b) => b.count - a.count),
      },
    });
  } catch (error) {
    logger.requestError("GET", "/activity", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Officer workload balancing stats
router.get("/workload", authenticateToken, requireRole("ADMIN"), async (_req, res) => {
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

    const officerCapacity = parseInt(process.env.OFFICER_CAPACITY || "10", 10);

    const enriched = officers.map((o) => ({
      ...o,
      activeCount: o._count.assignedRequests,
      capacity: officerCapacity,
      utilization: Math.round((o._count.assignedRequests / officerCapacity) * 100),
      status: o._count.assignedRequests >= officerCapacity ? "at_capacity" : o._count.assignedRequests >= 7 ? "high" : o._count.assignedRequests >= 4 ? "moderate" : "available",
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
    logger.requestError("GET", "/workload", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
