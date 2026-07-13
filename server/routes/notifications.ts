import { Router } from "express";
import prisma from "../lib/prisma.js";
import { authenticateToken } from "../middleware/auth.js";

const router = Router();

// List notifications
router.get("/", authenticateToken, async (req, res) => {
  try {
    const { page = "1", limit = "20" } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { recipientId: req.user!.userId },
        orderBy: { createdAt: "desc" },
        skip,
        take: parseInt(limit as string),
      }),
      prisma.notification.count({ where: { recipientId: req.user!.userId } }),
      prisma.notification.count({ where: { recipientId: req.user!.userId, isRead: false } }),
    ]);

    res.json({ notifications, total, unreadCount, totalPages: Math.ceil(total / parseInt(limit as string)) });
  } catch (error) {
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
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
