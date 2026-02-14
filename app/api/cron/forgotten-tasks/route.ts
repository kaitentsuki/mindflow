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

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Find active tasks not updated in 7+ days
  const forgotten = await prisma.thought.findMany({
    where: {
      type: "task",
      status: "active",
      updatedAt: { lte: sevenDaysAgo },
    },
    select: { id: true, userId: true, summary: true, cleanedText: true, updatedAt: true },
  });

  let notificationsCreated = 0;

  for (const thought of forgotten) {
    // Deduplicate — max once per 24h
    const exists = await notificationExists(
      thought.userId,
      thought.id,
      "forgotten_task",
      24
    );
    if (exists) continue;

    const daysSince = Math.floor(
      (Date.now() - thought.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    await createAndSendNotification({
      userId: thought.userId,
      thoughtId: thought.id,
      type: "forgotten_task",
      title: `Task untouched for ${daysSince} days`,
      body: thought.summary || thought.cleanedText.slice(0, 100),
      url: `/library?highlight=${thought.id}`,
    });
    notificationsCreated++;
  }

  return NextResponse.json({
    checked: forgotten.length,
    notificationsCreated,
    timestamp: new Date().toISOString(),
  });
}
