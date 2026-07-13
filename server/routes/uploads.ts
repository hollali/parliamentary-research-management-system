import { Router } from "express";
import prisma from "../lib/prisma.js";
import { authenticateToken } from "../middleware/auth.js";
import upload from "../middleware/upload.js";
import path from "path";
import fs from "fs";
import jwt from "jsonwebtoken";
import { fileURLToPath } from "url";
import JWT_SECRET from "../lib/jwt.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, "../../uploads");

const router = Router();

// List attachments for a request
router.get("/request/:requestId", authenticateToken, async (req, res) => {
  try {
    const { requestId } = req.params;
    const attachments = await prisma.attachment.findMany({
      where: { requestId },
      include: {
        uploader: { select: { id: true, firstName: true, lastName: true, initials: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(attachments);
  } catch (error) {
    console.error("List attachments error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Download an attachment — accepts token from header OR query param
router.get("/:attachmentId/download", async (req, res) => {
  try {
    const { attachmentId } = req.params;

    // Authenticate: check header first, then query param
    let userId: string;
    let role: string;
    const authHeader = req.headers.authorization;
    const queryToken = req.query.token as string | undefined;

    if (authHeader?.startsWith("Bearer ")) {
      const payload = jwt.verify(authHeader.slice(7), JWT_SECRET) as any;
      userId = payload.userId;
      role = payload.role;
    } else if (queryToken) {
      const payload = jwt.verify(queryToken, JWT_SECRET) as any;
      userId = payload.userId;
      role = payload.role;
    } else {
      return res.status(401).json({ error: "Authentication required" });
    }

    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: {
        request: {
          select: { id: true, submitterId: true, assignedOfficerId: true },
        },
      },
    });

    if (!attachment) {
      return res.status(404).json({ error: "Attachment not found" });
    }

    const isSubmitter = attachment.request.submitterId === userId;
    const isOfficer = attachment.request.assignedOfficerId === userId;
    const isAdmin = role === "ADMIN";

    if (!isSubmitter && !isOfficer && !isAdmin) {
      return res.status(403).json({ error: "Access denied" });
    }

    const filePath = path.join(uploadsDir, path.basename(attachment.filePath));
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found on disk" });
    }

    const mimeTypes: Record<string, string> = {
      PDF: "application/pdf",
      DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      XLSX: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ZIP: "application/zip",
    };

    res.setHeader("Content-Type", mimeTypes[attachment.fileType] || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(attachment.name)}"`);
    res.setHeader("Content-Length", fs.statSync(filePath).size);

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch (error) {
    console.error("Download error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Upload a file to a request
router.post(
  "/:requestId",
  authenticateToken,
  upload.single("file"),
  async (req, res) => {
    try {
      const { requestId } = req.params;

      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }

      const request = await prisma.researchRequest.findUnique({
        where: { id: requestId },
      });
      if (!request) {
        return res.status(404).json({ error: "Request not found" });
      }

      // Authorization: only the submitter, assigned officer, or admin can upload
      const { role, userId } = req.user!;
      const isSubmitter = request.submitterId === userId;
      const isOfficer = request.assignedOfficerId === userId;
      const isAdmin = role === "ADMIN";
      if (!isSubmitter && !isOfficer && !isAdmin) {
        return res.status(403).json({ error: "Access denied" });
      }

      const ext = req.file.originalname.split(".").pop()?.toUpperCase();
      const fileType = ext === "PDF" ? "PDF" : ext === "DOCX" ? "DOCX" : ext === "XLSX" ? "XLSX" : "ZIP";

      const attachment = await prisma.attachment.create({
        data: {
          requestId,
          uploadedById: req.user!.userId,
          name: req.file.originalname,
          fileType: fileType as "PDF" | "DOCX" | "XLSX" | "ZIP",
          filePath: `/uploads/${req.file.filename}`,
          fileSize: req.file.size,
        },
        include: {
          uploader: { select: { id: true, firstName: true, lastName: true, initials: true } },
        },
      });

      await prisma.activityLog.create({
        data: {
          authorId: req.user!.userId,
          action: "FILE_UPLOADED",
          entityType: "Attachment",
          entityId: attachment.id,
          description: `File "${req.file.originalname}" uploaded for request ${request.requestNumber}`,
        },
      });

      res.status(201).json(attachment);
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default router;
