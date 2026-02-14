import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// PATCH /api/notifications/[id] — mark as read or dismiss
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !("id" in session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id as string;
  const { id } = await params;

  const body = await request.json();
  const { action } = body; // "read" | "dismiss"

  const notification = await prisma.notification.findFirst({
    where: { id, userId },
  });

  if (!notification) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data: Record<string, Date> = {};
  if (action === "read") data.readAt = new Date();
  if (action === "dismiss") data.dismissedAt = new Date();

  const updated = await prisma.notification.update({
    where: { id },
    data,
  });

  return NextResponse.json(updated);
}
