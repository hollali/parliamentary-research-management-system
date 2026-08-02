import { Router } from "express";
import prisma from "../lib/prisma.js";
import { authenticateToken } from "../middleware/auth.js";
import { logger } from "../lib/logger.js";

const router = Router();

// List all templates (built-in + user's custom)
router.get("/", authenticateToken, async (req, res) => {
  try {
    const templates = await prisma.template.findMany({
      where: {
        OR: [
          { isBuiltIn: true },
          { createdById: req.user!.userId },
        ],
      },
      orderBy: [{ isBuiltIn: "desc" }, { createdAt: "desc" }],
    });
    res.json(templates);
  } catch (error) {
    logger.requestError("GET", "/", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get a single template
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const template = await prisma.template.findUnique({
      where: { id: req.params.id },
    });
    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }
    res.json(template);
  } catch (error) {
    logger.requestError("GET", "/:id", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create a custom template
router.post("/", authenticateToken, async (req, res) => {
  try {
    const { name, description, category, sections } = req.body;
    if (!name || !category) {
      return res.status(400).json({ error: "Name and category are required" });
    }

    const template = await prisma.template.create({
      data: {
        name,
        description: description || null,
        category,
        sections: sections || [],
        isBuiltIn: false,
        createdById: req.user!.userId,
      },
    });

    res.status(201).json(template);
  } catch (error) {
    logger.requestError("POST", "/", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete a custom template
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const template = await prisma.template.findUnique({
      where: { id: req.params.id },
      select: { createdById: true, isBuiltIn: true },
    });

    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }
    if (template.isBuiltIn) {
      return res.status(403).json({ error: "Cannot delete built-in templates" });
    }
    if (template.createdById !== req.user!.userId && req.user!.role !== "ADMIN") {
      return res.status(403).json({ error: "Access denied" });
    }

    await prisma.template.delete({ where: { id: req.params.id } });
    res.json({ message: "Template deleted" });
  } catch (error) {
    logger.requestError("DELETE", "/:id", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
