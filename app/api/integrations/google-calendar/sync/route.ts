import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getCalendarClient, createCalendarEvent } from "@/lib/google-calendar";

// POST — Sync all thoughts with deadlines to Google Calendar
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !("id" in session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id as string;

  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
  });
  if (!account?.access_token) {
    return NextResponse.json({ error: "Google Calendar not connected" }, { status: 400 });
  }

  const thoughts = await prisma.thought.findMany({
    where: {
      userId,
      deadline: { not: null },
      calendarEventId: null,
      status: { in: ["active", "snoozed"] },
    },
  });

  const client = getCalendarClient(account.access_token, account.refresh_token || "");
  let synced = 0;
  const errors: string[] = [];

  for (const thought of thoughts) {
    try {
      const eventId = await createCalendarEvent(client, {
        summary: thought.summary || thought.cleanedText,
        deadline: thought.deadline!.toISOString(),
        description: thought.cleanedText,
      });
      await prisma.thought.update({
        where: { id: thought.id },
        data: { calendarEventId: eventId },
      });
      synced++;
    } catch (err) {
      errors.push(`Failed to sync thought ${thought.id}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  return NextResponse.json({ synced, total: thoughts.length, errors });
}
