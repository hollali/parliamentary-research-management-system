import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import prisma from "../lib/prisma.js";
import { generateToken, authenticateToken } from "../middleware/auth.js";
import { sendEmail, passwordResetEmail } from "../lib/email.js";
import { rateLimit } from "../lib/rateLimit.js";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

const router = Router();

router.post("/login", rateLimit(15 * 60 * 1000, 10), async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await prisma.activityLog.create({
      data: {
        authorId: user.id,
        action: "LOGIN",
        entityType: "User",
        entityId: user.id,
        description: `${user.firstName} ${user.lastName} logged in`,
      },
    });

    const token = generateToken({ userId: user.id, role: user.role });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        title: user.title,
        initials: user.initials,
        avatarUrl: user.avatarUrl,
        departmentId: user.departmentId,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/forgot-password", rateLimit(15 * 60 * 1000, 5), async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // Always return the same message to prevent user enumeration
    const successMessage = { message: "If an account exists, a reset link has been sent" };

    if (!user) {
      return res.json(successMessage);
    }

    // Generate a secure random token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Invalidate any existing tokens for this user
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    // Store the new token
    await prisma.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt },
    });

    // Send reset email
    const resetUrl = `${FRONTEND_URL}/reset-password?token=${token}`;
    const emailContent = passwordResetEmail(user.firstName, resetUrl);
    await sendEmail({ to: user.email, ...emailContent });

    res.json(successMessage);
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/reset-password", rateLimit(15 * 60 * 1000, 10), async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: "Token and new password are required" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    // Hash the new password and update
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    });

    // Mark token as used
    await prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    });

    await prisma.activityLog.create({
      data: {
        authorId: resetToken.userId,
        action: "UPDATED",
        entityType: "User",
        entityId: resetToken.userId,
        description: "Password reset via email",
      },
    });

    res.json({ message: "Password has been reset successfully" });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/profile", authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { firstName, lastName, title, phone, constituency } = req.body;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(title !== undefined && { title }),
        ...(phone !== undefined && { phone }),
        ...(constituency !== undefined && { constituency }),
      },
      select: { id: true, firstName: true, lastName: true, role: true, title: true, initials: true, email: true, departmentId: true, constituency: true },
    });

    res.json(user);
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/change-password", authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user!.userId;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current and new password are required" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: "New password must be at least 8 characters" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const validPassword = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await prisma.activityLog.create({
      data: {
        authorId: userId,
        action: "UPDATED",
        entityType: "User",
        entityId: userId,
        description: "Password changed",
      },
    });

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get notification preferences
router.get("/notification-prefs", authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { notificationPrefs: true },
    });
    res.json(user?.notificationPrefs || {
      pushNotifications: true,
      emailSummaries: true,
      triggers: { newAssignments: true, statusChanges: true, draftMentions: true, deadlineReminders: true },
    });
  } catch (error) {
    console.error("Get notification prefs error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update notification preferences
router.put("/notification-prefs", authenticateToken, async (req, res) => {
  try {
    const prefs = req.body;
    if (!prefs || typeof prefs !== "object" || typeof prefs.pushNotifications !== "boolean" || typeof prefs.emailSummaries !== "boolean") {
      return res.status(400).json({ error: "Invalid notification preferences" });
    }
    // Limit payload size
    if (JSON.stringify(prefs).length > 1024) {
      return res.status(400).json({ error: "Preferences payload too large" });
    }
    await prisma.user.update({
      where: { id: req.user!.userId },
      data: { notificationPrefs: prefs },
    });
    res.json({ message: "Preferences updated" });
  } catch (error) {
    console.error("Update notification prefs error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
