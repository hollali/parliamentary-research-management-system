import prisma from "./prisma.js";
import type { NotificationType } from "../../src/generated/prisma/enums.js";
import { sendEmail, notificationEmail } from "./email.js";
import { isWhatsAppConfigured, sendWhatsAppNotification } from "./whatsapp.js";

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

// Check if a user has real-time email notifications enabled
export async function shouldEmail(userId: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { notificationPrefs: true },
    });
    const prefs = user?.notificationPrefs as any;
    if (!prefs) return true;
    return prefs.emailNotifications !== false;
  } catch {
    return true;
  }
}

// Check if a user has WhatsApp notifications enabled
export async function shouldWhatsApp(userId: string): Promise<boolean> {
  if (!isWhatsAppConfigured()) return false;
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { notificationPrefs: true },
    });
    const prefs = user?.notificationPrefs as any;
    return prefs?.whatsappNotifications === true;
  } catch {
    return false;
  }
}

// Dispatch email + WhatsApp after an in-app notification is created
async function dispatchChannels(
  notification: {
    recipientId: string;
    title: string;
    message: string;
    link?: string | null;
  },
  channels: { email: boolean; whatsapp: boolean },
) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: notification.recipientId },
      select: { email: true, phone: true, firstName: true, notificationPrefs: true },
    });
    if (!user) return;

    const prefs = (user.notificationPrefs || {}) as any;

    // Real-time email (unless the caller already sends a dedicated email)
    if (channels.email && prefs.emailNotifications !== false) {
      const { subject, html, text } = notificationEmail(
        user.firstName,
        notification.title,
        notification.message,
        notification.link,
      );
      sendEmail({ to: user.email, subject, html, text }).catch(() => {});
    }

    // WhatsApp (requires configured API + user opt-in + phone on file)
    if (channels.whatsapp && isWhatsAppConfigured() && prefs.whatsappNotifications === true && user.phone) {
      sendWhatsAppNotification(user.phone, {
        title: notification.title,
        message: notification.message,
        link: notification.link,
      }).catch(() => {});
    }
  } catch {
    // Channel dispatch failures should never block notification creation
  }
}

// Create a notification with a link that points to the correct frontend route.
// By default email + WhatsApp are dispatched for every notification. Pass
// { dispatchEmail: false } when the caller sends its own dedicated email
// (e.g. assignmentEmail), and { dispatchWhatsApp: false } to skip WhatsApp.
export async function createNotification(
  data: {
    recipientId: string;
    type: NotificationType;
    title: string;
    message: string;
    requestId?: string;
    requestNumber?: string;
  },
  options?: { dispatchEmail?: boolean; dispatchWhatsApp?: boolean },
) {
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
  const notification = await prisma.notification.create({
    data: { ...rest, link },
  });

  const channels = {
    email: options?.dispatchEmail !== false,
    whatsapp: options?.dispatchWhatsApp !== false,
  };
  dispatchChannels(notification, channels).catch(() => {});

  return notification;
}