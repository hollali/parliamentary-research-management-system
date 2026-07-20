import prisma from "./prisma.js";
import { logger } from "./logger.js";

export async function checkOverdueRequests(): Promise<void> {
  try {
    const now = new Date();

    const overdueRequests = await prisma.researchRequest.findMany({
      where: {
        deadline: { lt: now },
        status: {
          in: ["SUBMITTED", "ASSIGNED", "IN_PROGRESS", "DRAFT_SUBMITTED", "REVISION_REQUESTED", "REVISED"],
        },
      },
      include: {
        submitter: { select: { id: true, firstName: true, lastName: true } },
        officer: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (overdueRequests.length === 0) return;

    const recentThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    for (const request of overdueRequests) {
      const recentNotification = await prisma.notification.findFirst({
        where: {
          link: `/requests/${request.id}`,
          type: "GENERAL",
          title: "Request Overdue",
          createdAt: { gte: recentThreshold },
        },
      });

      if (recentNotification) continue;

      const recipientIds = new Set<string>();
      if (request.assignedOfficerId) recipientIds.add(request.assignedOfficerId);
      recipientIds.add(request.submitterId);

      const daysOverdue = Math.ceil((now.getTime() - request.deadline.getTime()) / (1000 * 60 * 60 * 24));

      for (const recipientId of recipientIds) {
        await prisma.notification.create({
          data: {
            recipientId,
            type: "GENERAL",
            title: "Request Overdue",
            message: `"${request.title}" (${request.requestNumber}) is ${daysOverdue} day${daysOverdue > 1 ? "s" : ""} overdue.`,
            link: `/requests/${request.id}`,
          },
        });
      }
    }
  } catch (error) {
    logger.requestError("SYSTEM", "checkOverdueRequests", error);
  }
}
