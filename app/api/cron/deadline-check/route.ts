import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron-auth";
import { prisma } from "@/lib/db";
import {
  createAndSendNotification,
  notificationExists,
} from "@/lib/notifications";

export async function POST(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const in1h = new Date(now.getTime() + 60 * 60 * 1000);

  // Find thoughts with deadlines in the next 24h that are still active
  const upcoming = await prisma.thought.findMany({
    where: {
      deadline: { gte: now, lte: in24h },
      status: "active",
      type: { in: ["task", "reminder"] },
    },
    select: { id: true, userId: true, summary: true, cleanedText: true, deadline: true },
  });

  let notificationsCreated = 0;

  for (const thought of upcoming) {
    const deadline = thought.deadline!;
    const hoursUntil = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Determine reminder type based on time remaining
    const isUrgent = hoursUntil <= 1;
    const type = isUrgent ? "deadline_1h" : "deadline_24h";
    const dedupeHours = isUrgent ? 2 : 12;

    // Deduplication check
    const exists = await notificationExists(
      thought.userId,
      thought.id,
      type,
      dedupeHours
    );
    if (exists) continue;

    const title = isUrgent
      ? `Deadline in less than 1 hour!`
      : `Deadline approaching (${Math.round(hoursUntil)}h)`;
    const body = thought.summary || thought.cleanedText.slice(0, 100);

    await createAndSendNotification({
      userId: thought.userId,
      thoughtId: thought.id,
      type,
      title,
      body,
      url: `/library?highlight=${thought.id}`,
    });
    notificationsCreated++;
  }

  return NextResponse.json({
    checked: upcoming.length,
    notificationsCreated,
    timestamp: now.toISOString(),
  });
}
