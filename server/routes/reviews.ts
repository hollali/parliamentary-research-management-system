import { Router } from "express";
import prisma from "../lib/prisma.js";
import { authenticateToken } from "../middleware/auth.js";
import { sendEmail, revisionRequestedEmail, commentAddedEmail } from "../lib/email.js";
import { shouldNotify, shouldEmail, createNotification } from "../lib/notifications.js";
import { lookupByIdOrNumber } from "../lib/requestUtils.js";
import { logger } from "../lib/logger.js";

const router = Router();


// List reviews for a request
router.get("/request/:requestId", authenticateToken, async (req, res) => {
  try {
    const request = await prisma.researchRequest.findUnique({
      where: lookupByIdOrNumber(req.params.requestId),
      select: { id: true },
    });
    if (!request) {
      return res.json([]);
    }

    const comments = await prisma.reviewComment.findMany({
      where: { requestId: request.id, parentId: null },
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

// Add review comment — admins and the requesting MP may comment
router.post("/", authenticateToken, async (req, res) => {
  try {
    const { reportId, requestId, section, text, highlightedText, startOffset, endOffset, parentId } = req.body;

    if (!reportId || !requestId || !text) {
      return res.status(400).json({ error: "reportId, requestId, and text are required" });
    }

    const request = await prisma.researchRequest.findUnique({
      where: lookupByIdOrNumber(requestId),
      select: { id: true, title: true, requestNumber: true, assignedOfficerId: true, submitterId: true },
    });
    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    // Access control: admins and the requesting MP may comment
    const { role, userId } = req.user!;
    const isAdmin = role === "ADMIN";
    const isSubmitter = role === "MP" && request.submitterId === userId;
    if (!isAdmin && !isSubmitter) {
      return res.status(403).json({ error: "Access denied" });
    }

    // The report must belong to the request
    const report = await prisma.researchReport.findUnique({
      where: { id: reportId },
      select: { id: true, requestId: true },
    });
    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }
    if (report.requestId !== request.id) {
      return res.status(400).json({ error: "Report does not belong to this request" });
    }

    const comment = await prisma.reviewComment.create({
      data: {
        reportId,
        requestId: request.id,
        authorId: userId,
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
        authorId: userId,
        action: "COMMENT_ADDED",
        entityType: "ReviewComment",
        entityId: comment.id,
        description: `Review comment added to request`,
      },
    });

    // Notify the assigned officer (respecting preferences)
    if (request.assignedOfficerId) {
      if (await shouldNotify(request.assignedOfficerId, 'draftMentions')) {
        await createNotification({
          recipientId: request.assignedOfficerId,
          type: "REPORT_UPLOADED",
          title: "New Review Comment",
          message: `New comment on "${request.title}": ${text.slice(0, 100)}${text.length > 100 ? '...' : ''}`,
          requestId: request.id,
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

// Request revision — admins and the requesting MP may request revisions
router.post("/request-revision", authenticateToken, async (req, res) => {
  try {
    const { requestId, commentText } = req.body;

    if (!requestId) {
      return res.status(400).json({ error: "requestId is required" });
    }

    const resolvedRequest = await prisma.researchRequest.findUnique({
      where: lookupByIdOrNumber(requestId),
    });
    if (!resolvedRequest) {
      return res.status(404).json({ error: "Request not found" });
    }

    // Access control: admins and the requesting MP may request revisions
    const { role, userId } = req.user!;
    const isAdmin = role === "ADMIN";
    const isSubmitter = role === "MP" && resolvedRequest.submitterId === userId;
    if (!isAdmin && !isSubmitter) {
      return res.status(403).json({ error: "Access denied" });
    }

    await prisma.researchRequest.update({
      where: { id: resolvedRequest.id },
      data: { status: "REVISION_REQUESTED" },
    });

    await prisma.activityLog.create({
      data: {
        authorId: userId,
        action: "STATUS_CHANGED",
        entityType: "ResearchRequest",
        entityId: resolvedRequest.id,
        description: `${isAdmin ? "Admin" : "Member"} requested revision${commentText ? `: ${commentText.slice(0, 160)}` : ""}`,
      },
    });

    const request = await prisma.researchRequest.findUnique({
      where: { id: resolvedRequest.id },
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
        await createNotification({
          recipientId,
          type: "REVISION_REQUESTED",
          title: "Revision Requested",
          message: `${isAdmin ? "An administrator" : "The requesting member"} requested a revision for: ${request!.title}`,
          requestId: request!.id,
        });
      }

      if (await shouldEmail(recipientId)) {
        const email = revisionRequestedEmail(recipient.firstName, request!.requestNumber, request!.title, emailText);
        sendEmail({ to: recipient.email, ...email }).catch((err) => logger.requestError("POST", "/request-revision (email)", err));
      }
    }

    // Notify all admins when the revision was requested by the MP
    if (isSubmitter) {
      const admins = await prisma.user.findMany({
        where: { role: { in: ["ADMIN"] }, isActive: true },
        select: { id: true, email: true, firstName: true },
      });
      for (const admin of admins) {
        if (await shouldNotify(admin.id, 'statusChanges')) {
          await createNotification({
            recipientId: admin.id,
            type: "REVISION_REQUESTED",
            title: "Member Requested Revision",
            message: `The member requested a revision for: ${request!.title}`,
            requestId: request!.id,
          });
        }
        if (await shouldEmail(admin.id)) {
          const email = revisionRequestedEmail(admin.firstName, request!.requestNumber, request!.title, emailText);
          sendEmail({ to: admin.email, ...email }).catch((err) => logger.requestError("POST", "/request-revision (email)", err));
        }
      }
    }

    res.json({ message: "Revision requested" });
  } catch (error) {
    logger.requestError("POST", "/request-revision", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Approve / accept report — admins and the requesting MP may accept
router.post("/approve", authenticateToken, async (req, res) => {
  try {
    const { reportId, requestId } = req.body;

    const request = await prisma.researchRequest.findUnique({
      where: lookupByIdOrNumber(requestId),
    });
    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    // Access control: admins and the requesting MP may accept
    const { role, userId } = req.user!;
    const isAdmin = role === "ADMIN";
    const isSubmitter = role === "MP" && request.submitterId === userId;
    if (!isAdmin && !isSubmitter) {
      return res.status(403).json({ error: "Access denied" });
    }

    const report = await prisma.researchReport.findUnique({ where: { id: reportId } });
    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }

    const acceptedAt = new Date();
    const [updatedReport, updatedRequest] = await prisma.$transaction([
      prisma.researchReport.update({
        where: { id: reportId },
        data: {
          isApproved: true,
          approvedAt: acceptedAt,
          approvedById: userId,
          isDraft: false,
        },
      }),
      prisma.researchRequest.update({
        where: { id: request.id },
        data: { status: "APPROVED", dateCompleted: acceptedAt },
      }),
    ]);

    await prisma.activityLog.create({
      data: {
        authorId: userId,
        action: "APPROVED",
        entityType: "ResearchReport",
        entityId: reportId,
        description: `Report approved/accepted for ${request.requestNumber}${isSubmitter ? " by the requesting member" : ""}`,
      },
    });

    // Notify the submitting MP (when approved by an admin)
    if (isAdmin && request.submitterId) {
      if (await shouldNotify(request.submitterId, 'statusChanges')) {
        await createNotification({
          recipientId: request.submitterId,
          type: "REPORT_APPROVED",
          title: "Report Approved",
          message: `Your research request has been approved: ${request.title}`,
          requestId: request.id,
        });
      }
    }

    // Notify assigned officers that their report was accepted
    const assigneeIds = new Set<string>();
    if (request.assignedOfficerId) assigneeIds.add(request.assignedOfficerId);
    const assignments = await prisma.assignment.findMany({
      where: { requestId: request.id, assignedToId: { not: null }, declinedAt: null, supersededAt: null },
      select: { assignedToId: true },
    });
    for (const a of assignments) {
      if (a.assignedToId) assigneeIds.add(a.assignedToId);
    }

    for (const assigneeId of assigneeIds) {
      if (await shouldNotify(assigneeId, 'statusChanges')) {
        await createNotification({
          recipientId: assigneeId,
          type: "REPORT_APPROVED",
          title: "Report Accepted",
          message: `Your research brief for "${request.title}" has been accepted`,
          requestId: request.id,
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
