import { Router } from "express";
import prisma from "../lib/prisma.js";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import { sendEmail, revisionRequestedEmail, commentAddedEmail } from "../lib/email.js";

const router = Router();

// List reviews for a request
router.get("/request/:requestId", authenticateToken, async (req, res) => {
  try {
    const comments = await prisma.reviewComment.findMany({
      where: { requestId: req.params.requestId },
      include: { author: { select: { id: true, firstName: true, lastName: true, initials: true, title: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(comments);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Add review comment
router.post("/", authenticateToken, requireRole("ADMIN"), async (req, res) => {
  try {
    const { reportId, requestId, section, text, highlightedText, startOffset, endOffset } = req.body;

    if (!reportId || !requestId || !text) {
      return res.status(400).json({ error: "reportId, requestId, and text are required" });
    }

    const comment = await prisma.reviewComment.create({
      data: {
        reportId,
        requestId,
        authorId: req.user!.userId,
        section,
        text,
        highlightedText: highlightedText || null,
        startOffset: startOffset ?? null,
        endOffset: endOffset ?? null,
      },
      include: { author: { select: { id: true, firstName: true, lastName: true, initials: true, title: true } } },
    });

    await prisma.activityLog.create({
      data: {
        authorId: req.user!.userId,
        action: "COMMENT_ADDED",
        entityType: "ReviewComment",
        entityId: comment.id,
        description: `Review comment added to request`,
      },
    });

    // Notify the assigned officer
    const request = await prisma.researchRequest.findUnique({ where: { id: requestId } });
    if (request?.assignedOfficerId) {
      await prisma.notification.create({
        data: {
          recipientId: request.assignedOfficerId,
          type: "REPORT_UPLOADED",
          title: "New Review Comment",
          message: `Admin commented on "${request.title}": ${text.slice(0, 100)}${text.length > 100 ? '...' : ''}`,
          link: `/requests/${requestId}`,
        },
      });

      const officer = await prisma.user.findUnique({
        where: { id: request.assignedOfficerId },
        select: { firstName: true, email: true },
      });
      if (officer) {
        const sectionLabel = section || "General";
        const email = commentAddedEmail(officer.firstName, request.requestNumber, request.title, sectionLabel, text, highlightedText);
        await sendEmail({ to: officer.email, ...email });
      }
    }

    res.status(201).json(comment);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Resolve a review comment
router.put("/:commentId/resolve", authenticateToken, async (req, res) => {
  try {
    const comment = await prisma.reviewComment.findUnique({ where: { id: req.params.commentId } });
    if (!comment) {
      return res.status(404).json({ error: "Comment not found" });
    }

    const updated = await prisma.reviewComment.update({
      where: { id: req.params.commentId },
      data: { resolved: true },
    });

    await prisma.activityLog.create({
      data: {
        authorId: req.user!.userId,
        action: "UPDATED",
        entityType: "ReviewComment",
        entityId: comment.id,
        description: "Review comment resolved",
      },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Request revision
router.post("/:commentId/request-revision", authenticateToken, requireRole("ADMIN"), async (req, res) => {
  try {
    const { requestId } = req.body;

    const comment = await prisma.reviewComment.findUnique({ where: { id: req.params.commentId } });
    if (!comment) {
      return res.status(404).json({ error: "Comment not found" });
    }

    await prisma.researchRequest.update({
      where: { id: requestId },
      data: { status: "REVISION_REQUESTED" },
    });

    await prisma.activityLog.create({
      data: {
        authorId: req.user!.userId,
        action: "STATUS_CHANGED",
        entityType: "ResearchRequest",
        entityId: requestId,
        description: "Revision requested",
      },
    });

    const request = await prisma.researchRequest.findUnique({ where: { id: requestId } });
    if (request?.assignedOfficerId) {
      await prisma.notification.create({
        data: {
          recipientId: request.assignedOfficerId,
          type: "REVISION_REQUESTED",
          title: "Revision Requested",
          message: `Revision requested for: ${request.title}`,
          link: `/requests/${requestId}`,
        },
      });

      // Send email to officer
      const officer = await prisma.user.findUnique({ where: { id: request.assignedOfficerId }, select: { firstName: true, email: true } });
      if (officer) {
        const email = revisionRequestedEmail(officer.firstName, request.requestNumber, request.title, comment.text || "Please review the feedback and revise your draft.");
        await sendEmail({ to: officer.email, ...email });
      }
    }

    res.json({ message: "Revision requested" });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Approve report
router.post("/approve", authenticateToken, requireRole("ADMIN"), async (req, res) => {
  try {
    const { reportId, requestId } = req.body;

    const report = await prisma.researchReport.findUnique({ where: { id: reportId } });
    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }

    const [updatedReport, updatedRequest] = await prisma.$transaction([
      prisma.researchReport.update({
        where: { id: reportId },
        data: {
          isApproved: true,
          approvedAt: new Date(),
          approvedById: req.user!.userId,
          isDraft: false,
        },
      }),
      prisma.researchRequest.update({
        where: { id: requestId },
        data: { status: "APPROVED" },
      }),
    ]);

    const request = await prisma.researchRequest.findUnique({ where: { id: requestId } });

    await prisma.activityLog.create({
      data: {
        authorId: req.user!.userId,
        action: "APPROVED",
        entityType: "ResearchReport",
        entityId: reportId,
        description: `Report approved for ${request?.requestNumber}`,
      },
    });

    if (request?.submitterId) {
      await prisma.notification.create({
        data: {
          recipientId: request.submitterId,
          type: "REPORT_APPROVED",
          title: "Report Approved",
          message: `Your research request has been approved: ${request.title}`,
          link: `/requests/${requestId}`,
        },
      });
    }

    res.json({ report: updatedReport, request: updatedRequest });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
