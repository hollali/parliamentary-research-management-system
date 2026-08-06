import { Router } from "express";
import prisma from "../lib/prisma.js";
import { authenticateToken } from "../middleware/auth.js";
import { lookupByIdOrNumber } from "../lib/requestUtils.js";
import upload from "../middleware/upload.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { logger } from "../lib/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, "../../uploads");

const router = Router();

function canAccessRequest(request: {
  submitterId: string | null;
  assignedOfficerId: string | null;
  teamId: string | null;
  assignments?: Array<{ assignedToId: string | null }>;
  team?: { members?: Array<{ userId: string }> } | null;
}, userId: string, role: string) {
  if (role === "ADMIN") return true;

  const isSubmitter = request.submitterId === userId;
  const isAssignedOfficer = request.assignedOfficerId === userId;
  const isDirectAssignment = request.assignments?.some((assignment) => assignment.assignedToId === userId) ?? false;
  const isTeamMember = request.team?.members?.some((member) => member.userId === userId) ?? false;

  return isSubmitter || isAssignedOfficer || isDirectAssignment || isTeamMember;
}

// List attachments for a request
router.get("/request/:requestId", authenticateToken, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { userId, role } = req.user!;
    const request = await prisma.researchRequest.findUnique({
      where: lookupByIdOrNumber(requestId),
      select: {
        id: true,
        requestNumber: true,
        submitterId: true,
        assignedOfficerId: true,
        teamId: true,
        assignments: { select: { assignedToId: true } },
        team: { select: { members: { select: { userId: true } } } },
      },
    });

    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    if (!canAccessRequest(request, userId, role)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const attachments = await prisma.attachment.findMany({
      where: { requestId: request.id },
      include: {
        uploader: { select: { id: true, firstName: true, lastName: true, initials: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(attachments);
  } catch (error) {
    logger.requestError("GET", "/request/:requestId", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Download an attachment — requires Authorization header only
router.get("/:attachmentId/download", authenticateToken, async (req, res) => {
  try {
    const { attachmentId } = req.params;
    const userId = req.user!.userId;
    const role = req.user!.role;

    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: {
        request: {
          select: {
            id: true,
            submitterId: true,
            assignedOfficerId: true,
            teamId: true,
            assignments: { select: { assignedToId: true } },
            team: { select: { members: { select: { userId: true } } } },
          },
        },
      },
    });

    if (!attachment) {
      return res.status(404).json({ error: "Attachment not found" });
    }

    if (!canAccessRequest(attachment.request, userId, role)) {
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
  PPTX: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  TXT: "text/plain",
  CSV: "text/csv",
  RTF: "application/rtf",
  ODT: "application/vnd.oasis.opendocument.text",
  ZIP: "application/zip",
};

    const safeName = attachment.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    res.setHeader("Content-Type", mimeTypes[attachment.fileType] || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(attachment.name)}`);
    res.setHeader("Content-Length", fs.statSync(filePath).size);

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch (error) {
    logger.requestError("GET", "/:attachmentId/download", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete (un-upload) an attachment — only the uploader or an admin can remove it
router.delete("/:attachmentId", authenticateToken, async (req, res) => {
  try {
    const { attachmentId } = req.params;
    const { userId, role } = req.user!;

    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: {
        request: {
          select: {
            requestNumber: true,
            submitterId: true,
            assignedOfficerId: true,
            teamId: true,
            assignments: { select: { assignedToId: true } },
            team: { select: { members: { select: { userId: true } } } },
          },
        },
      },
    });

    if (!attachment) {
      return res.status(404).json({ error: "Attachment not found" });
    }

    if (!canAccessRequest(attachment.request, userId, role)) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Only the uploader or an admin may remove the file
    if (attachment.uploadedById !== userId && role !== "ADMIN") {
      return res.status(403).json({ error: "Only the uploader or an admin can remove this file" });
    }

    // Remove the physical file from disk (ignore missing files)
    const filePath = path.join(uploadsDir, path.basename(attachment.filePath));
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await prisma.attachment.delete({ where: { id: attachmentId } });

    await prisma.activityLog.create({
      data: {
        authorId: userId,
        action: "UPDATED",
        entityType: "Attachment",
        entityId: attachmentId,
        description: `File "${attachment.name}" removed from request ${attachment.request.requestNumber}`,
      },
    });

    res.json({ message: "Attachment removed" });
  } catch (error) {
    logger.requestError("DELETE", "/:attachmentId", error);
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
        where: lookupByIdOrNumber(requestId),
        select: {
          id: true,
          requestNumber: true,
          submitterId: true,
          assignedOfficerId: true,
          teamId: true,
          assignments: { select: { assignedToId: true } },
          team: { select: { members: { select: { userId: true } } } },
        },
      });
      if (!request) {
        return res.status(404).json({ error: "Request not found" });
      }

      // Authorization: only the submitter, assigned officer, direct assignees, team members, or admin can upload
      const { role, userId } = req.user!;
      if (!canAccessRequest(request, userId, role)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const EXT_TO_TYPE: Record<string, "PDF" | "DOCX" | "XLSX" | "PPTX" | "TXT" | "CSV" | "RTF" | "ODT" | "ZIP"> = {
        pdf: "PDF",
        docx: "DOCX",
        xlsx: "XLSX",
        pptx: "PPTX",
        txt: "TXT",
        csv: "CSV",
        rtf: "RTF",
        odt: "ODT",
        zip: "ZIP",
      };
      const ext = req.file.originalname.split(".").pop()?.toLowerCase() || "";
      const fileType = EXT_TO_TYPE[ext] || "ZIP";

      const attachment = await prisma.attachment.create({
        data: {
          requestId: request.id,
          uploadedById: req.user!.userId,
          name: req.file.originalname,
          fileType,
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
      logger.requestError("POST", "/:requestId", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default router;
