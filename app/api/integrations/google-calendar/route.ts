import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  getCalendarClient,
  createCalendarEvent,
  deleteCalendarEvent,
} from "@/lib/google-calendar";

async function getGoogleAccount(userId: string) {
  return prisma.account.findFirst({
    where: {
      userId,
      provider: "google",
    },
  });
}

// GET — Check if user has Google Calendar connected
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !("id" in session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id as string;

  const account = await getGoogleAccount(userId);
  return NextResponse.json({
    connected: !!account,
    hasCalendarScope: account?.scope?.includes("calendar") || false,
  });
}

// POST — Create calendar event for a thought
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !("id" in session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id as string;

  const { thoughtId } = await request.json();
  if (!thoughtId) {
    return NextResponse.json({ error: "thoughtId required" }, { status: 400 });
  }

  const thought = await prisma.thought.findFirst({
    where: { id: thoughtId, userId },
  });
  if (!thought) {
    return NextResponse.json({ error: "Thought not found" }, { status: 404 });
  }
  if (!thought.deadline) {
    return NextResponse.json({ error: "Thought has no deadline" }, { status: 400 });
  }

  const account = await getGoogleAccount(userId);
  if (!account?.access_token) {
    return NextResponse.json({ error: "Google Calendar not connected" }, { status: 400 });
  }

  const client = getCalendarClient(account.access_token, account.refresh_token || "");
  const eventId = await createCalendarEvent(client, {
    summary: thought.summary || thought.cleanedText,
    deadline: thought.deadline.toISOString(),
    description: thought.cleanedText,
  });

  await prisma.thought.update({
    where: { id: thoughtId },
    data: { calendarEventId: eventId },
  });

  return NextResponse.json({ eventId });
}

// DELETE — Remove calendar event for a thought
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !("id" in session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id as string;

  const { thoughtId } = await request.json();
  const thought = await prisma.thought.findFirst({
    where: { id: thoughtId, userId },
  });
  if (!thought?.calendarEventId) {
    return NextResponse.json({ error: "No calendar event to remove" }, { status: 400 });
  }

  const account = await getGoogleAccount(userId);
  if (!account?.access_token) {
    return NextResponse.json({ error: "Google Calendar not connected" }, { status: 400 });
  }

  const client = getCalendarClient(account.access_token, account.refresh_token || "");
  await deleteCalendarEvent(client, thought.calendarEventId);

  await prisma.thought.update({
    where: { id: thoughtId },
    data: { calendarEventId: null },
  });

  return NextResponse.json({ removed: true });
}
