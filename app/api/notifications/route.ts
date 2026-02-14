import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/notifications — list notifications (paginated, filterable)
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !("id" in session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id as string;

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "20");
  const offset = parseInt(searchParams.get("offset") || "0");
  const type = searchParams.get("type");
  const unreadOnly = searchParams.get("unread") === "true";

  const where: Record<string, unknown> = {
    userId,
    dismissedAt: null,
  };
  if (type) where.type = type;
  if (unreadOnly) where.readAt = null;

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        thought: {
          select: { id: true, summary: true, cleanedText: true, type: true },
        },
      },
    }),
    prisma.notification.count({ where }),
  ]);

  return NextResponse.json({ notifications, total });
}
