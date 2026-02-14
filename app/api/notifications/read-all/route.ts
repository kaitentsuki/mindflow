import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// POST /api/notifications/read-all — mark all notifications as read
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !("id" in session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id as string;

  const result = await prisma.notification.updateMany({
    where: {
      userId,
      readAt: null,
      dismissedAt: null,
    },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ updated: result.count });
}
