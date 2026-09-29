import { Router } from "express";
import prisma from "../lib/prisma.js";
import { authenticateToken } from "../middleware/auth.js";
import { sendEmail, revisionRequestedEmail, commentAddedEmail, memberConfirmedEmail } from "../lib/email.js";
import { shouldNotify, shouldEmail, createNotification } from "../lib/notifications.js";
import { lookupByIdOrNumber } from "../lib/requestUtils.js";
import { authorizeRequest } from "../lib/authorization.js";
import { sanitizeRichText } from "../lib/sanitize.js";
import { logger } from "../lib/logger.js";
import type { RequestStatus } from "../../src/generated/prisma/enums.js";

const router = Router();

// A member can only sign off on research an admin has already approved.
const CONFIRMABLE_STATUSES: RequestStatus[] = ["APPROVED", "DELIVERED"];


// List reviews for a request
router.get("/request/:requestId", authenticateToken, async (req, res) => {
  try {
    // The write path below is gated to admins and the submitting MP; the read
    // path has to enforce the same rule or any account can read every
    // participant's feedback and highlighted passages on any request.
    const access = await authorizeRequest(req.params.requestId, req.user!);
    if (!access) {
      return res.status(404).json({ error: "Request not found" });
    }

    const comments = await prisma.reviewComment.findMany({
      where: { requestId: access.id, parentId: null },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, initials: true, title: true } },
        replies: {
          where: { requestId: access.id },
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

    if (!requestId || !text) {
      return res.status(400).json({ error: "requestId and text are required" });
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

    // When attached to a report, the report must belong to the request.
    // Comments without a reportId are request-level directives/feedback.
    if (reportId) {
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
    }

    // A reply must point at a root comment on the SAME request. Without this
    // check a comment authored on request A could be grafted into request B's
    // thread, leaking it to B's participants and hiding it from A.
    if (parentId) {
      const parent = await prisma.reviewComment.findUnique({
        where: { id: parentId },
        select: { id: true, requestId: true, parentId: true },
      });
      if (!parent) {
        return res.status(404).json({ error: "Parent comment not found" });
      }
      if (parent.requestId !== request.id) {
        return res.status(400).json({ error: "Parent comment belongs to a different request" });
      }
      if (parent.parentId !== null) {
        return res.status(400).json({ error: "Replies cannot be nested more than one level" });
      }
    }

    if (typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "text must be a non-empty string" });
    }

    const comment = await prisma.reviewComment.create({
      data: {
        reportId: reportId || null,
        requestId: request.id,
        authorId: userId,
        section,
        // Comment text is plain, but highlightedText quotes a passage out of
        // the report. Both are stripped of markup so no future rendering path
        // can turn them into script.
        text: sanitizeRichText(text),
        highlightedText: highlightedText ? sanitizeRichText(highlightedText) : null,
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
        }, { dispatchEmail: false });
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
    const { role, userId } = req.user!;
    const comment = await prisma.reviewComment.findUnique({
      where: { id: req.params.commentId },
      select: { id: true, requestId: true, authorId: true, resolved: true },
    });
    if (!comment) {
      return res.status(404).json({ error: "Comment not found" });
    }

    // Only admins and the submitting MP may close feedback on this request.
    // Previously this route had no authorization at all: any authenticated
    // account could resolve any comment in the system, and the activity log
    // then attributed the action to them.
    const access = await authorizeRequest(comment.requestId, { role, userId });
    if (!access) {
      return res.status(403).json({ error: "Access denied" });
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
        }, { dispatchEmail: false });
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
          }, { dispatchEmail: false });
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

    // The authorization above is against the request, so the report has to
    // belong to that same request. Without this check the submitting MP of R1
    // could approve an arbitrary report owned by a different member.
    if (report.requestId !== request.id) {
      return res.status(400).json({ error: "Report does not belong to this request" });
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
          title: "Report Approved",
          message: `Your research brief for "${request.title}" has been approved`,
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

// Member sign-off — the requesting MP confirms they are satisfied with a brief
// that has already been approved (and optionally delivered) by an admin.
router.post("/confirm", authenticateToken, async (req, res) => {
  try {
    const { requestId, note } = req.body;

    if (!requestId) {
      return res.status(400).json({ error: "requestId is required" });
    }

    const request = await prisma.researchRequest.findUnique({
      where: lookupByIdOrNumber(requestId),
      include: { submitter: { select: { firstName: true, lastName: true } } },
    });
    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    // Only the member who submitted the request may sign off on it.
    const { role, userId } = req.user!;
    const isSubmitter = role === "MP" && request.submitterId === userId;
    if (!isSubmitter) {
      return res.status(403).json({ error: "Only the requesting member can confirm this brief" });
    }

    // Sign-off is only meaningful once an admin has approved the research.
    // `memberConfirmedAt` — not the status — is the idempotency guard: a brief
    // that has been signed off moves straight to CLOSED, so checking the status
    // would let the member confirm the same brief twice.
    if (request.memberConfirmedAt || request.status === "MEMBER_CONFIRMED") {
      return res.status(409).json({ error: "This brief has already been confirmed" });
    }
    if (!CONFIRMABLE_STATUSES.includes(request.status)) {
      return res.status(400).json({ error: "This brief is not awaiting your confirmation" });
    }

    const confirmedAt = new Date();
    const trimmedNote = typeof note === "string" && note.trim() ? note.trim() : null;

    // The member's sign-off completes the request. Leaving it sitting in a
    // "Confirmed by Member" state meant the brief never actually closed, and the
    // status badge read "Confirmed" on a finished job.
    const updatedRequest = await prisma.researchRequest.update({
      where: { id: request.id },
      data: {
        status: "CLOSED",
        dateClosed: confirmedAt,
        memberConfirmedAt: confirmedAt,
        memberConfirmedById: userId,
        memberConfirmationNote: trimmedNote,
      },
    });

    // Record the member's remarks on the request timeline so they stay visible
    // alongside the brief itself.
    if (trimmedNote) {
      await prisma.reviewComment.create({
        data: {
          requestId: request.id,
          authorId: userId,
          section: "Member Sign-off",
          text: trimmedNote,
        },
        include: { author: { select: { id: true, firstName: true, lastName: true, initials: true, title: true } } },
      });
    }

    await prisma.activityLog.create({
      data: {
        authorId: userId,
        action: "MEMBER_CONFIRMED",
        entityType: "ResearchRequest",
        entityId: request.id,
        description: `Member confirmed satisfaction and closed the brief for ${request.requestNumber}${trimmedNote ? `: ${trimmedNote.slice(0, 160)}` : ""}`,
      },
    });

    // Notify every active admin for the record. The request is already closed.
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", isActive: true },
      select: { id: true, email: true, firstName: true },
    });

    const memberName = `${request.submitter?.firstName ?? ""} ${request.submitter?.lastName ?? ""}`.trim() || "The requesting member";
    const confirmedAtLabel = confirmedAt.toLocaleString("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    for (const admin of admins) {
      if (await shouldNotify(admin.id, "statusChanges")) {
        await createNotification({
          recipientId: admin.id,
          type: "MEMBER_CONFIRMED",
          title: "Brief Confirmed and Closed",
          message: `${memberName} confirmed they are satisfied with "${request.title}", which is now closed.`,
          requestId: request.id,
        }, { dispatchEmail: false });
      }

      if (await shouldEmail(admin.id)) {
        const email = memberConfirmedEmail(
          admin.firstName,
          request.requestNumber,
          request.title,
          memberName,
          confirmedAtLabel,
          trimmedNote,
        );
        sendEmail({ to: admin.email, ...email }).catch((err) => logger.requestError("POST", "/confirm (email)", err));
      }
    }

    res.json({ request: updatedRequest, confirmedAt });
  } catch (error) {
    logger.requestError("POST", "/confirm", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
