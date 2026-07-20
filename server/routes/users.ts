import { Router } from "express";
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma.js";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import { logger } from "../lib/logger.js";

const VALID_ROLES = ["ADMIN", "RESEARCH_OFFICER", "RESEARCH_ASSISTANT", "MP"] as const;

const router = Router();

// List users
router.get("/", authenticateToken, requireRole("ADMIN"), async (req, res) => {
  try {
    const { role, search } = req.query;

    const where: any = {};
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { firstName: { contains: search as string, mode: "insensitive" } },
        { lastName: { contains: search as string, mode: "insensitive" } },
        { email: { contains: search as string, mode: "insensitive" } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        title: true,
        phone: true,
        initials: true,
        isActive: true,
        departmentId: true,
        createdAt: true,
        lastLoginAt: true,
        department: { select: { id: true, name: true } },
        _count: { select: { submittedRequests: true, assignedRequests: true, authoredReports: true } },
      },
      orderBy: { firstName: "asc" },
    });

    res.json(users);
  } catch (error) {
    logger.requestError("GET", "/", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create user
router.post("/", authenticateToken, requireRole("ADMIN"), async (req, res) => {
  try {
    const { email, password, firstName, lastName, role, title, phone, departmentId } = req.body;

    if (!email || !password || !firstName || !lastName || !role) {
      return res.status(400).json({ error: "email, password, firstName, lastName, and role are required" });
    }

    if (!VALID_ROLES.includes(role as any)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}` });
    }

    if (typeof password !== "string" || password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      return res.status(400).json({ error: "Password must contain uppercase, lowercase, and a number" });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: "A user with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        role,
        title,
        phone,
        initials,
        departmentId,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        title: true,
        initials: true,
        departmentId: true,
        createdAt: true,
      },
    });

    await prisma.activityLog.create({
      data: {
        authorId: req.user!.userId,
        action: "CREATED",
        entityType: "User",
        entityId: user.id,
        description: `User ${firstName} ${lastName} created with role ${role}`,
      },
    });

    res.status(201).json(user);
  } catch (error) {
    logger.requestError("POST", "/", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update user
router.put("/:id", authenticateToken, requireRole("ADMIN"), async (req, res) => {
  try {
    const { firstName, lastName, role, title, phone, departmentId, isActive } = req.body;

    if (role && !VALID_ROLES.includes(role as any)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}` });
    }

    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const initials = firstName && lastName
      ? `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
      : undefined;

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(role && { role }),
        ...(title !== undefined && { title }),
        ...(phone !== undefined && { phone }),
        ...(departmentId !== undefined && { departmentId }),
        ...(isActive !== undefined && { isActive }),
        ...(initials && { initials }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        title: true,
        initials: true,
        isActive: true,
        departmentId: true,
      },
    });

    res.json(updated);
  } catch (error) {
    logger.requestError("PUT", "/:id", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Reset password
router.post("/:id/reset-password", authenticateToken, requireRole("ADMIN"), async (req, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: req.params.id },
      data: { passwordHash },
    });

    await prisma.activityLog.create({
      data: {
        authorId: req.user!.userId,
        action: "UPDATED",
        entityType: "User",
        entityId: req.params.id,
        description: `Password reset for ${user.email}`,
      },
    });

    res.json({ message: "Password reset successfully" });
  } catch (error) {
    logger.requestError("POST", "/:id/reset-password", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Deactivate user
router.post("/:id/deactivate", authenticateToken, requireRole("ADMIN"), async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });

    await prisma.activityLog.create({
      data: {
        authorId: req.user!.userId,
        action: "DEACTIVATED",
        entityType: "User",
        entityId: req.params.id,
        description: `User ${user.email} deactivated`,
      },
    });

    res.json({ message: "User deactivated" });
  } catch (error) {
    logger.requestError("POST", "/:id/deactivate", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
