import { prisma } from "./db";
import { sendPushToUser } from "./push";

interface CreateNotificationParams {
  userId: string;
  thoughtId?: string;
  type: string;
  title: string;
  body?: string;
  url?: string;
}

/**
 * Create a notification in DB and send push (if not quiet hours).
 */
export async function createAndSendNotification(
  params: CreateNotificationParams
): Promise<{ id: string; pushSent: boolean }> {
  const { userId, thoughtId, type, title, body, url } = params;

  // Check user preferences
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });

  const prefs = (user?.preferences as Record<string, unknown>) || {};
  const notifPrefs = (prefs.notifications as Record<string, unknown>) || {};

  // Check if this notification type is enabled
  if (!isNotificationTypeEnabled(notifPrefs, type)) {
    return { id: "", pushSent: false };
  }

  // Create DB record
  const notification = await prisma.notification.create({
    data: {
      userId,
      thoughtId: thoughtId || null,
      type,
      title,
      body: body || null,
      url: url || null,
      scheduledFor: new Date(),
    },
  });

  // Send push if not quiet hours
  let pushSent = false;
  if (!isQuietHours(notifPrefs)) {
    await sendPushToUser(userId, {
      title,
      body: body || undefined,
      tag: `${type}-${thoughtId || notification.id}`,
      url: url || "/notifications",
    });
    await prisma.notification.update({
      where: { id: notification.id },
      data: { sentAt: new Date() },
    });
    pushSent = true;
  }

  return { id: notification.id, pushSent };
}

/**
 * Check if a notification with the same thoughtId+type already exists
 * within the given number of hours.
 */
export async function notificationExists(
  userId: string,
  thoughtId: string,
  type: string,
  withinHours: number
): Promise<boolean> {
  const since = new Date();
  since.setHours(since.getHours() - withinHours);

  const count = await prisma.notification.count({
    where: {
      userId,
      thoughtId,
      type,
      createdAt: { gte: since },
    },
  });

  return count > 0;
}

/**
 * Check if current time is within quiet hours.
 * Default: 22:00–08:00 in user's configured timezone.
 */
export function isQuietHours(
  notifPrefs: Record<string, unknown>
): boolean {
  const start = (notifPrefs.quiet_hours_start as string) || "22:00";
  const end = (notifPrefs.quiet_hours_end as string) || "08:00";
  const timezone = (notifPrefs.timezone as string) || "Europe/Prague";

  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0");
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value || "0");
  const currentMinutes = hour * 60 + minute;

  const [startH, startM] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  // Handle overnight quiet hours (e.g., 22:00–08:00)
  if (startMinutes > endMinutes) {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

/**
 * Check if a notification type is enabled in user preferences.
 */
export function isNotificationTypeEnabled(
  notifPrefs: Record<string, unknown>,
  type: string
): boolean {
  // Global enabled check
  if (notifPrefs.enabled === false) return false;

  // Map notification types to preference keys
  const typeToKey: Record<string, string> = {
    deadline_reminder: "deadline_reminders",
    deadline_24h: "deadline_reminders",
    deadline_1h: "deadline_reminders",
    forgotten_task: "forgotten_tasks",
    morning_briefing: "morning_briefing",
    weekly_digest: "weekly_digest",
    connection: "connection_suggestions",
    insight: "insights",
  };

  const key = typeToKey[type];
  if (key && notifPrefs[key] === false) return false;

  return true;
}

/**
 * Get unread notification count for a user.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: {
      userId,
      readAt: null,
      dismissedAt: null,
    },
  });
}
