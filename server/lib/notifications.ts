import prisma from "./prisma.js";
import type { NotificationType } from "../../src/generated/prisma/enums.js";

// Check if a user has a notification trigger enabled
export async function shouldNotify(userId: string, trigger: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { notificationPrefs: true },
    });
    const prefs = user?.notificationPrefs as any;
    if (!prefs) return true;
    if (prefs.pushNotifications === false) return false;
    if (prefs.triggers && prefs.triggers[trigger] === false) return false;
    return true;
  } catch {
    return true;
  }
}

// Check if a user has email summaries enabled
export async function shouldEmail(userId: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { notificationPrefs: true },
    });
    const prefs = user?.notificationPrefs as any;
    if (!prefs) return true;
    return prefs.emailSummaries !== false;
  } catch {
    return true;
  }
}

// Create a notification with a link that points to the correct frontend route
export async function createNotification(data: {
  recipientId: string;
  type: NotificationType;
  title: string;
  message: string;
  requestId?: string;
  requestNumber?: string;
}) {
  const { requestId, requestNumber, ...rest } = data;
  let link: string | undefined;
  if (requestNumber) {
    link = `/briefs/${requestNumber}`;
  } else if (requestId) {
    const req = await prisma.researchRequest.findUnique({
      where: { id: requestId },
      select: { requestNumber: true },
    });
    link = req ? `/briefs/${req.requestNumber}` : `/briefs/${requestId}`;
  }
  return prisma.notification.create({
    data: { ...rest, link },
  });
}
