import { Router } from "express";
import prisma from "../lib/prisma.js";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import { sendEmail, draftSubmittedEmail } from "../lib/email.js";
import { shouldNotify, shouldEmail, createNotification } from "../lib/notifications.js";
import { logger } from "../lib/logger.js";
import { lookupByIdOrNumber } from "../lib/requestUtils.js";

const router = Router();

async function officerCanWorkRequest(requestId: string, userId: string): Promise<boolean> {
  const request = await prisma.researchRequest.findUnique({
    where: { id: requestId },
    select: {
      assignedOfficerId: true,
      assignments: { select: { assignedToId: true, declinedAt: true, supersededAt: true } },
      team: { select: { members: { select: { userId: true } } } },
    },
  });
  if (!request) return false;
  if (request.assignedOfficerId === userId) return true;
  if (request.assignments?.some((a) => a.assignedToId === userId && !a.declinedAt && !a.supersededAt)) return true;
  if (request.team?.members?.some((m) => m.userId === userId)) return true;
  return false;
}

// Upload report
router.post("/", authenticateToken, requireRole("RESEARCH_OFFICER", "ADMIN"), async (req, res) => {
  try {
    const { requestId, title, content, filePath, fileType, fileSize, isDraft, notes } = req.body;

    if (!requestId || !title) {
      return res.status(400).json({ error: "requestId and title are required" });
    }

    const request = await prisma.researchRequest.findUnique({ where: lookupByIdOrNumber(requestId) });
    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    // Only working/officer-owned states are editable; reviews must be submitted
    // from these states and never resurface from APPROVED/DELIVERED/CLOSED.
    const editableStatuses = ["ASSIGNED", "IN_PROGRESS", "DRAFT_SUBMITTED", "REVISION_REQUESTED", "REVISED"];
    if (req.user!.role === "RESEARCH_OFFICER" && !editableStatuses.includes(request.status)) {
      return res.status(409).json({ error: "Request is not in an editable state" });
    }

    // RESEARCH_OFFICERs may only upload reports for requests they are assigned
    // to — directly, as the named officer, or via the assigned team.
    if (req.user!.role === "RESEARCH_OFFICER" && !(await officerCanWorkRequest(request.id, req.user!.userId))) {
      return res.status(403).json({ error: "Not assigned to this request" });
    }

    // Get next version number
    const lastReport = await prisma.researchReport.findFirst({
      where: { requestId: request.id },
      orderBy: { version: "desc" },
    });
    const nextVersion = (lastReport?.version || 0) + 1;

    const report = await prisma.researchReport.create({
      data: {
        requestId: request.id,
        authorId: req.user!.userId,
        uploadedById: req.user!.userId,
        title,
        content,
        filePath,
        fileType: fileType || "PDF",
        fileSize,
        isDraft: isDraft !== false,
        version: nextVersion,
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, initials: true } },
      },
    });

    // Create version record
    await prisma.reportVersion.create({
      data: {
        reportId: report.id,
        version: nextVersion,
        content,
        filePath,
        fileType: fileType || "PDF",
        fileSize,
        notes: notes || `Version ${nextVersion} uploaded`,
      },
    });

    // Workflow status only advances on an explicit submission. Auto-save and
    // Save Draft (isDraft true) must not move the request to "Draft Submitted"
    // nor notify reviewers. A resubmission after a revision request becomes
    // REVISED; a first submission becomes DRAFT_SUBMITTED.
    const isSubmission = isDraft === false;
    const nextStatus = isSubmission
      ? request.status === "REVISION_REQUESTED" ? "REVISED" : "DRAFT_SUBMITTED"
      : request.status;

    await prisma.researchRequest.update({
      where: { id: request.id },
      data: {
        ...(isSubmission ? { status: nextStatus } : {}),
        draftVersion: nextVersion,
      },
    });

    await prisma.activityLog.create({
      data: {
        authorId: req.user!.userId,
        action: "FILE_UPLOADED",
        entityType: "ResearchReport",
        entityId: report.id,
        description: `Report "${title}" uploaded (v${nextVersion}) for request ${request.requestNumber}`,
      },
    });

    // Notify all admins that a draft was submitted (only on real submissions,
    // not on every auto-save / Save Draft)
    if (isSubmission) {
      const admins = await prisma.user.findMany({
        where: { role: { in: ["ADMIN"] }, isActive: true },
        select: { id: true, email: true, firstName: true },
      });

      for (const admin of admins) {
        if (await shouldNotify(admin.id, 'draftMentions')) {
          await createNotification({
            recipientId: admin.id,
            type: "REPORT_UPLOADED",
            title: "Draft Submitted for Review",
            message: `A new draft (v${nextVersion}) has been submitted for: ${request.title}`,
            requestId,
          }, { dispatchEmail: false });
        }
        if (await shouldEmail(admin.id)) {
          const email = draftSubmittedEmail(admin.firstName, request.requestNumber, request.title, nextVersion);
          sendEmail({ to: admin.email, ...email }).catch((err) => logger.requestError("POST", "/ (email)", err));
        }
      }

      // Notify the requesting member that a new draft awaits their review
      if (request.submitterId) {
        const submitter = await prisma.user.findUnique({
          where: { id: request.submitterId },
          select: { id: true, email: true, firstName: true },
        });
        if (submitter) {
          if (await shouldNotify(submitter.id, 'statusChanges')) {
            await createNotification({
              recipientId: submitter.id,
              type: "REPORT_UPLOADED",
              title: "Research Brief Ready for Review",
              message: `A new draft (v${nextVersion}) of your research brief is ready: ${request.title}`,
              requestId: request.id,
            }, { dispatchEmail: false });
          }
          if (await shouldEmail(submitter.id)) {
            const email = draftSubmittedEmail(submitter.firstName, request.requestNumber, request.title, nextVersion);
            sendEmail({ to: submitter.email, ...email }).catch((err) => logger.requestError("POST", "/ (email)", err));
          }
        }
      }
    }

    res.status(201).json(report);
  } catch (error) {
    logger.requestError("POST", "/", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update existing report (auto-save)
router.put("/:reportId", authenticateToken, requireRole("RESEARCH_OFFICER", "ADMIN"), async (req, res) => {
  try {
    const { content, isDraft, notes } = req.body;
    const report = await prisma.researchReport.findUnique({ where: { id: req.params.reportId } });
    if (!report) return res.status(404).json({ error: "Report not found" });

    // RESEARCH_OFFICERs may edit their own reports, or reports for requests
    // they are currently assigned to (e.g. taking over a reassigned request).
    if (req.user!.role === "RESEARCH_OFFICER") {
      const canEdit =
        report.authorId === req.user!.userId ||
        (await officerCanWorkRequest(report.requestId, req.user!.userId));
      if (!canEdit) {
        return res.status(403).json({ error: "You can only edit reports assigned to you" });
      }
    }

    const updated = await prisma.researchReport.update({
      where: { id: report.id },
      data: {
        ...(content !== undefined && { content }),
        ...(isDraft !== undefined && { isDraft }),
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, initials: true } },
      },
    });

    res.json(updated);
  } catch (error) {
    logger.requestError("PUT", "/:reportId", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get report versions
router.get("/:reportId/versions", authenticateToken, async (req, res) => {
  try {
    const versions = await prisma.reportVersion.findMany({
      where: { reportId: req.params.reportId },
      orderBy: { version: "desc" },
    });
    res.json(versions);
  } catch (error) {
    logger.requestError("GET", "/:reportId/versions", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Compare two report versions
router.get("/:reportId/versions/:v1/compare/:v2", authenticateToken, async (req, res) => {
  try {
    const { reportId, v1, v2 } = req.params;
    const [versionA, versionB] = await Promise.all([
      prisma.reportVersion.findFirst({ where: { reportId, version: parseInt(v1) } }),
      prisma.reportVersion.findFirst({ where: { reportId, version: parseInt(v2) } }),
    ]);
    if (!versionA || !versionB) {
      return res.status(404).json({ error: "Version not found" });
    }
    res.json({ versionA, versionB });
  } catch (error) {
    logger.requestError("GET", "/:reportId/versions/:v1/compare/:v2", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
