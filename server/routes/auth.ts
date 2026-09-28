import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import prisma from "../lib/prisma.js";
import { generateToken, authenticateToken, requireRole } from "../middleware/auth.js";
import { sendEmail, passwordResetEmail } from "../lib/email.js";
import { rateLimit } from "../lib/rateLimit.js";
import { deriveInitials, validatePhone } from "../lib/profile.js";
import { DEFAULT_PREFS, validateNotificationPrefs } from "../lib/notificationPrefs.js";
import { logger } from "../lib/logger.js";

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
        constituency: user.constituency,
      },
    });
  } catch (error) {
    logger.requestError("POST", "/login", error);
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
    logger.requestError("POST", "/forgot-password", error);
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
    logger.requestError("POST", "/reset-password", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/profile", authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { firstName, lastName, title, phone, constituency } = req.body;

    if (firstName !== undefined && typeof firstName !== "string") {
      return res.status(400).json({ error: "firstName must be a string" });
    }
    if (lastName !== undefined && typeof lastName !== "string") {
      return res.status(400).json({ error: "lastName must be a string" });
    }
    // An empty firstName would leave the account nameless in every listing.
    if (typeof firstName === "string" && !firstName.trim()) {
      return res.status(400).json({ error: "First name cannot be empty" });
    }
    if (title !== undefined && title !== null && typeof title !== "string") {
      return res.status(400).json({ error: "title must be a string" });
    }
    if (phone !== undefined && phone !== null && typeof phone !== "string") {
      return res.status(400).json({ error: "phone must be a string" });
    }
    if (constituency !== undefined && constituency !== null && typeof constituency !== "string") {
      return res.status(400).json({ error: "constituency must be a string" });
    }
    // Only keep a phone number if it looks dialable; WhatsApp needs this field
    // to be populated, so storing junk here silently breaks notifications.
    const cleanPhone =
      phone === undefined ? undefined : phone === null ? null : String(phone).trim();
    const phoneError = cleanPhone ? validatePhone(cleanPhone) : "";
    if (phoneError) {
      return res.status(400).json({ error: phoneError });
    }

    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });
    if (!existing) {
      return res.status(404).json({ error: "User not found" });
    }

    const nextFirst = typeof firstName === "string" ? firstName.trim() : existing.firstName;
    const nextLast = typeof lastName === "string" ? lastName.trim() : existing.lastName;
    const nameChanged = nextFirst !== existing.firstName || nextLast !== existing.lastName;

    // Initials are denormalised onto the user row, so they must be rebuilt
    // whenever the name changes or every avatar keeps showing the old ones.
    const initials = deriveInitials(nextFirst, nextLast);

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(typeof firstName === "string" && { firstName: nextFirst }),
        ...(typeof lastName === "string" && { lastName: nextLast }),
        ...(nameChanged && { initials }),
        ...(title !== undefined && { title: title === null ? null : String(title).trim() || null }),
        ...(cleanPhone !== undefined && { phone: cleanPhone || null }),
        ...(constituency !== undefined && {
          constituency: constituency === null ? null : String(constituency).trim() || null,
        }),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
        title: true,
        initials: true,
        email: true,
        departmentId: true,
        constituency: true,
        phone: true,
        lastLoginAt: true,
      },
    });

    await prisma.activityLog.create({
      data: {
        authorId: userId,
        action: "UPDATED",
        entityType: "User",
        entityId: userId,
        description: nameChanged
          ? "Profile details updated (name changed)"
          : "Profile details updated",
      },
    });

    res.json(user);
  } catch (error) {
    logger.requestError("PUT", "/profile", error);
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
    logger.requestError("POST", "/change-password", error);
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
    res.json(user?.notificationPrefs || DEFAULT_PREFS);
  } catch (error) {
    logger.requestError("GET", "/notification-prefs", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Impersonate a user (admin only) — issues a new JWT for the target user
router.post("/impersonate", authenticateToken, requireRole("ADMIN"), async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      return res.status(404).json({ error: "User not found or inactive" });
    }

    await prisma.activityLog.create({
      data: {
        authorId: req.user!.userId,
        action: "LOGIN",
        entityType: "User",
        entityId: user.id,
        description: `${user.firstName} ${user.lastName} impersonated by admin`,
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
        constituency: user.constituency,
      },
    });
  } catch (error) {
    logger.requestError("POST", "/impersonate", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Logout
router.post("/logout", authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user!;
    await prisma.activityLog.create({
      data: {
        authorId: userId,
        action: "LOGOUT",
        entityType: "User",
        entityId: userId,
        description: "User logged out",
      },
    });
    res.json({ message: "Logged out successfully" });
  } catch (error) {
    logger.requestError("POST", "/logout", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Recent activity for the signed-in user only. Backs the Security section of
// the settings page with real records instead of decorative badges.
router.get("/activity", authenticateToken, async (req, res) => {
  try {
    const logs = await prisma.activityLog.findMany({
      where: { authorId: req.user!.userId },
      orderBy: { createdAt: "desc" },
      take: 15,
      select: { id: true, action: true, entityType: true, description: true, createdAt: true },
    });
    res.json(logs);
  } catch (error) {
    logger.requestError("GET", "/activity", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update notification preferences
router.put("/notification-prefs", authenticateToken, async (req, res) => {
  try {
    const validation = validateNotificationPrefs(req.body);
    if (!validation.ok) {
      return res.status(400).json({ error: validation.error });
    }
    await prisma.user.update({
      where: { id: req.user!.userId },
      // Safe cast: validateNotificationPrefs guarantees a plain JSON object of
      // booleans, which Prisma's narrower InputJsonValue type cannot infer.
      data: { notificationPrefs: validation.value as any },
    });
    await prisma.activityLog.create({
      data: {
        authorId: req.user!.userId,
        action: "UPDATED",
        entityType: "User",
        entityId: req.user!.userId,
        description: "Notification preferences updated",
      },
    });
    res.json({ message: "Preferences updated" });
  } catch (error) {
    logger.requestError("PUT", "/notification-prefs", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
