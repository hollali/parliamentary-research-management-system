import { Router } from "express";
import prisma from "../lib/prisma.js";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import { sendEmail, revisionRequestedEmail, commentAddedEmail } from "../lib/email.js";
import { shouldNotify, shouldEmail } from "../lib/notifications.js";
import { logger } from "../lib/logger.js";

const router = Router();


// List reviews for a request
router.get("/request/:requestId", authenticateToken, async (req, res) => {
  try {
    const comments = await prisma.reviewComment.findMany({
      where: { requestId: req.params.requestId, parentId: null },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, initials: true, title: true } },
        replies: {
          include: { author: { select: { id: true, firstName: true, lastName: true, initials: true, title: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(comments);
  } catch (error) {
    logger.requestError("GET", "/request/:requestId", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Add review comment
router.post("/", authenticateToken, requireRole("ADMIN"), async (req, res) => {
  try {
    const { reportId, requestId, section, text, highlightedText, startOffset, endOffset, parentId } = req.body;

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
        parentId: parentId || null,
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

    // Notify the assigned officer (respecting preferences)
    const request = await prisma.researchRequest.findUnique({ where: { id: requestId } });
    if (request?.assignedOfficerId) {
      if (await shouldNotify(request.assignedOfficerId, 'draftMentions')) {
        await prisma.notification.create({
          data: {
            recipientId: request.assignedOfficerId,
            type: "REPORT_UPLOADED",
            title: "New Review Comment",
            message: `Admin commented on "${request.title}": ${text.slice(0, 100)}${text.length > 100 ? '...' : ''}`,
            link: `/requests/${requestId}`,
          },
        });
      }

      if (await shouldEmail(request.assignedOfficerId)) {
        const officer = await prisma.user.findUnique({
          where: { id: request.assignedOfficerId },
          select: { firstName: true, email: true },
        });
        if (officer) {
          const sectionLabel = section || "General";
          const email = commentAddedEmail(officer.firstName, request.requestNumber, request.title, sectionLabel, text, highlightedText);
          sendEmail({ to: officer.email, ...email }).catch((err) => logger.requestError("POST", "/ (email)", err));
        }
      }
    }

    res.status(201).json(comment);
  } catch (error) {
    logger.requestError("POST", "/", error);
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
    logger.requestError("PUT", "/:commentId/resolve", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Request revision
router.post("/request-revision", authenticateToken, requireRole("ADMIN"), async (req, res) => {
  try {
    const { requestId, commentText } = req.body;

    if (!requestId) {
      return res.status(400).json({ error: "requestId is required" });
    }

    const requestObj = await prisma.researchRequest.findUnique({ where: { id: requestId } });
    if (!requestObj) {
      return res.status(404).json({ error: "Request not found" });
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

    const request = await prisma.researchRequest.findUnique({
      where: { id: requestId },
      include: {
        assignments: { include: { assignedTo: { select: { id: true, firstName: true, email: true } } } },
        team: { include: { members: { include: { user: { select: { id: true, firstName: true, email: true } } } } } },
      },
    });

    // Collect all unique assignees: direct officer + assignments + team members
    const recipientMap = new Map<string, { firstName: string; email: string }>();

    if (request?.assignedOfficerId) {
      const officer = await prisma.user.findUnique({
        where: { id: request.assignedOfficerId },
        select: { id: true, firstName: true, email: true },
      });
      if (officer) recipientMap.set(officer.id, { firstName: officer.firstName, email: officer.email });
    }

    for (const a of request?.assignments || []) {
      if (a.assignedTo?.id && a.assignedTo?.email) {
        recipientMap.set(a.assignedTo.id, { firstName: a.assignedTo.firstName, email: a.assignedTo.email });
      }
    }

    for (const m of request?.team?.members || []) {
      if (m.user?.id && m.user?.email) {
        recipientMap.set(m.user.id, { firstName: m.user.firstName, email: m.user.email });
      }
    }

    const emailText = commentText || "Please review the feedback and revise your draft.";

    for (const [recipientId, recipient] of recipientMap) {
      if (await shouldNotify(recipientId, 'statusChanges')) {
        await prisma.notification.create({
          data: {
            recipientId,
            type: "REVISION_REQUESTED",
            title: "Revision Requested",
            message: `Revision requested for: ${request!.title}`,
            link: `/requests/${requestId}`,
          },
        });
      }

      if (await shouldEmail(recipientId)) {
        const email = revisionRequestedEmail(recipient.firstName, request!.requestNumber, request!.title, emailText);
        sendEmail({ to: recipient.email, ...email }).catch((err) => logger.requestError("POST", "/request-revision (email)", err));
      }
    }

    res.json({ message: "Revision requested" });
  } catch (error) {
    logger.requestError("POST", "/request-revision", error);
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
      if (await shouldNotify(request.submitterId, 'statusChanges')) {
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
    }

    res.json({ report: updatedReport, request: updatedRequest });
  } catch (error) {
    logger.requestError("POST", "/approve", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
