import prisma from "./prisma.js";
import { logger } from "./logger.js";
import { createNotification, shouldNotify } from "./notifications.js";

const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;

const OVERDUE_STATUSES = [
  "SUBMITTED",
  "ASSIGNED",
  "IN_PROGRESS",
  "DRAFT_SUBMITTED",
  "REVISION_REQUESTED",
  "REVISED",
] as const;

export async function checkOverdueRequests(): Promise<void> {
  try {
    const now = new Date();

    const overdueRequests = await prisma.researchRequest.findMany({
      where: {
        deadline: { lt: now },
        status: { in: [...OVERDUE_STATUSES] },
      },
      select: {
        id: true,
        title: true,
        requestNumber: true,
        deadline: true,
        assignedOfficerId: true,
        submitterId: true,
      },
    });

    if (overdueRequests.length === 0) return;

    const recipientIds = new Set<string>();
    for (const request of overdueRequests) {
      if (request.assignedOfficerId) recipientIds.add(request.assignedOfficerId);
      recipientIds.add(request.submitterId);
    }

    // One query for every recipient, instead of one per request. The previous
    // check was not scoped to the recipient at all, so the first reminder
    // written for a request permanently suppressed the reminder for the second
    // recipient as well.
    const windowStart = new Date(now.getTime() - DEDUP_WINDOW_MS);
    const existing = await prisma.notification.findMany({
      where: {
        recipientId: { in: [...recipientIds] },
        type: "GENERAL",
        title: "Request Overdue",
        createdAt: { gte: windowStart },
      },
      select: { recipientId: true, link: true },
    });

    const alreadyNotified = new Set(
      existing.map((n) => `${n.recipientId}::${n.link ?? ""}`),
    );

    for (const request of overdueRequests) {
      const link = `/briefs/${request.requestNumber}`;
      const daysOverdue = Math.ceil(
        (now.getTime() - request.deadline.getTime()) / (1000 * 60 * 60 * 24),
      );
      const message = `"${request.title}" (${request.requestNumber}) is ${daysOverdue} day${daysOverdue > 1 ? "s" : ""} overdue.`;

      const targets = new Set<string>();
      if (request.assignedOfficerId) targets.add(request.assignedOfficerId);
      targets.add(request.submitterId);

      for (const recipientId of targets) {
        if (alreadyNotified.has(`${recipientId}::${link}`)) continue;

        // Deadline reminders are opt-out via the member's notification
        // preferences. Only the in-app notification is gated here — email and
        // WhatsApp are dispatched by createNotification, which applies the
        // channel preferences itself. Gating on shouldEmail too meant a member
        // with email turned off never got an in-app reminder either.
        if (!(await shouldNotify(recipientId, "deadlineReminders"))) continue;

        await createNotification({
          recipientId,
          type: "GENERAL",
          title: "Request Overdue",
          message,
          requestNumber: request.requestNumber,
        });

        alreadyNotified.add(`${recipientId}::${link}`);
      }
    }
  } catch (error) {
    logger.requestError("SYSTEM", "checkOverdueRequests", error);
  }
}
