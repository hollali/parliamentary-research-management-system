import { Router } from "express";
import prisma from "../lib/prisma.js";
import { authenticateToken } from "../middleware/auth.js";
import { lookupByIdOrNumber } from "../lib/requestUtils.js";
import upload from "../middleware/upload.js";
import path from "path";
import fs from "fs";
import os from "os";
import { fileURLToPath } from "url";
import { execFile } from "child_process";
import { promisify } from "util";
import { logger } from "../lib/logger.js";
import { canAccessRequest, accessRequestSelect } from "../lib/authorization.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, "../../uploads");
const execFileAsync = promisify(execFile);

const router = Router();

/** Bound on concurrent LibreOffice conversions, to cap server memory use. */
const MAX_CONCURRENT_CONVERSIONS = 4;
let activeConversions = 0;

// List attachments for a request
router.get("/request/:requestId", authenticateToken, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { userId, role } = req.user!;
    const request = await prisma.researchRequest.findUnique({
      where: lookupByIdOrNumber(requestId),
      select: { ...accessRequestSelect, requestNumber: true },
    });

    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    if (!canAccessRequest(request, { userId, role })) {
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
  let tempPdfDir: string | null = null;

  try {
    const { attachmentId } = req.params;
    const userId = req.user!.userId;
    const role = req.user!.role;

    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: {
        request: { select: accessRequestSelect },
      },
    });

    if (!attachment) {
      return res.status(404).json({ error: "Attachment not found" });
    }

    if (!canAccessRequest(attachment.request, { userId, role })) {
      return res.status(403).json({ error: "Access denied" });
    }

    const filePath = path.join(uploadsDir, path.basename(attachment.filePath));
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found on disk" });
    }

    let servePath = filePath;
    let contentType = "application/pdf";
    let downloadName = attachment.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const pdfName = downloadName.replace(/\.[^.]+$/, "") + ".pdf";

    // Convert non-PDF, non-ZIP files to PDF via LibreOffice headless
    if (attachment.fileType !== "PDF" && attachment.fileType !== "ZIP") {
      // LibreOffice is expensive (hundreds of MB RSS per process). Without a
      // bound, one member could spawn hundreds of concurrent conversions and
      // exhaust the server. Skip the queue when it is saturated rather than
      // failing the whole request.
      if (activeConversions >= MAX_CONCURRENT_CONVERSIONS) {
        return res.status(503).json({ error: "Document conversion is busy, please retry shortly" });
      }
      activeConversions += 1;
      try {
        tempPdfDir = fs.mkdtempSync(path.join(os.tmpdir(), "prrms-pdf-"));
        await execFileAsync(
          "soffice",
          ["--headless", "--convert-to", "pdf", "--outdir", tempPdfDir, filePath],
          { timeout: 60_000 },
        );
        const converted = path.join(tempPdfDir, path.basename(filePath, path.extname(filePath)) + ".pdf");
        if (fs.existsSync(converted)) {
          servePath = converted;
          downloadName = pdfName;
          contentType = "application/pdf";
        } else {
          logger.requestError("PDF conversion", attachment.name, new Error("Converted file not found"));
        }
      } catch (convErr) {
        logger.requestError("PDF conversion", attachment.name, convErr);
      } finally {
        activeConversions -= 1;
      }
    } else if (attachment.fileType === "ZIP") {
      contentType = "application/zip";
    }

    // `filename*` is only meaningful for the converted PDF. For every other
    // type it must track the real name, otherwise browsers download a ZIP as
    // "data.pdf" because filename* takes precedence.
    const dispositionName = downloadName;
    res.setHeader("Content-Type", contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${dispositionName}"; filename*=UTF-8''${encodeURIComponent(dispositionName)}`,
    );

    let size: number;
    try {
      size = fs.statSync(servePath).size;
    } catch (statErr) {
      logger.requestError("stat", attachment.name, statErr);
      return res.status(404).json({ error: "File not found on disk" });
    }
    res.setHeader("Content-Length", size);

    // Clean up the temp directory on completion AND on client abort. "finish"
    // alone never fires for an aborted response, which leaked a temp dir on
    // every cancelled download. The handle must not be nulled on the failure
    // paths above or the directory is never removed.
    if (tempPdfDir) {
      const dir = tempPdfDir;
      const cleanup = () => {
        try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
      };
      res.on("close", cleanup);
    }

    const stream = fs.createReadStream(servePath);
    // An unhandled 'error' on the stream is a fatal, uncaught exception that
    // takes down the whole process. The file can vanish between the statSync
    // above and the stream's open() (e.g. a concurrent delete).
    stream.on("error", (streamErr) => {
      logger.requestError("stream", attachment.name, streamErr);
      if (!res.headersSent) {
        res.status(404).json({ error: "File not found on disk" });
      } else {
        res.destroy();
      }
    });
    res.on("close", () => stream.destroy());
    stream.pipe(res);
  } catch (error) {
    logger.requestError("GET", "/:attachmentId/download", error);
    if (tempPdfDir) {
      try { fs.rmSync(tempPdfDir, { recursive: true, force: true }); } catch {}
    }
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
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
        request: { select: { ...accessRequestSelect, requestNumber: true } },
      },
    });

    if (!attachment) {
      return res.status(404).json({ error: "Attachment not found" });
    }

    if (!canAccessRequest(attachment.request, { userId, role })) {
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
        select: { ...accessRequestSelect, requestNumber: true },
      });
      if (!request) {
        return res.status(404).json({ error: "Request not found" });
      }

      // Authorization: only the submitter, assigned officer, direct assignees, team members, or admin can upload
      const { role, userId } = req.user!;
      if (!canAccessRequest(request, { userId, role })) {
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
