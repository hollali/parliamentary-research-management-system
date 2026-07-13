import { Router } from "express";
import prisma from "../lib/prisma.js";
import { authenticateToken } from "../middleware/auth.js";

const router = Router();

function clampPagination(page: string, limit: string) {
  const p = Math.max(1, parseInt(page) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit) || 20));
  return { page: p, limit: l, skip: (p - 1) * l };
}

// List notifications
router.get("/", authenticateToken, async (req, res) => {
  try {
    const { page: rawPage = "1", limit: rawLimit = "20" } = req.query;
    const { page, limit, skip } = clampPagination(rawPage as string, rawLimit as string);

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { recipientId: req.user!.userId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where: { recipientId: req.user!.userId } }),
      prisma.notification.count({ where: { recipientId: req.user!.userId, isRead: false } }),
    ]);

    res.json({ notifications, total, unreadCount, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error("List notifications error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Mark notification as read
router.put("/:id/read", authenticateToken, async (req, res) => {
  try {
    // Verify the notification belongs to the authenticated user
    const existing = await prisma.notification.findUnique({ where: { id: req.params.id }, select: { recipientId: true } });
    if (!existing) {
      return res.status(404).json({ error: "Notification not found" });
    }
    if (existing.recipientId !== req.user!.userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const notification = await prisma.notification.update({
      where: { id: req.params.id },
      data: { isRead: true },
    });
    res.json(notification);
  } catch (error) {
    console.error("Mark read error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Mark all as read
router.put("/read-all", authenticateToken, async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { recipientId: req.user!.userId, isRead: false },
      data: { isRead: true },
    });
    res.json({ message: "All notifications marked as read" });
  } catch (error) {
    console.error("Mark all read error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
