import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/settings — get user preferences
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !("id" in session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id as string;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });

  const defaults = {
    timezone: "Europe/Prague",
    language: "cs",
    notifications: {
      enabled: true,
      deadline_reminders: true,
      forgotten_tasks: true,
      morning_briefing: true,
      weekly_digest: true,
      connection_suggestions: true,
      insights: false,
      quiet_hours_start: "22:00",
      quiet_hours_end: "08:00",
    },
  };

  const prefs = (user?.preferences as Record<string, unknown>) || {};
  const merged = {
    ...defaults,
    ...prefs,
    notifications: {
      ...defaults.notifications,
      ...((prefs.notifications as Record<string, unknown>) || {}),
    },
  };

  return NextResponse.json(merged);
}

// PATCH /api/settings — update user preferences
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !("id" in session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id as string;

  const updates = await request.json();

  // Get current preferences
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });

  const current = (user?.preferences as Record<string, unknown>) || {};

  // Deep merge for notifications
  const merged = { ...current, ...updates };
  if (updates.notifications && current.notifications) {
    merged.notifications = {
      ...(current.notifications as Record<string, unknown>),
      ...(updates.notifications as Record<string, unknown>),
    };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { preferences: merged },
  });

  return NextResponse.json(merged);
}
