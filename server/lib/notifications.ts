import prisma from "./prisma.js";

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
