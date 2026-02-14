import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/conversations — list user's conversations
export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user && "id" in session.user ? (session.user.id as string) : null;
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const conversations = await prisma.conversation.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: {
      messages: {
        take: 1,
        orderBy: { createdAt: "desc" },
        select: { content: true, createdAt: true },
      },
    },
  });

  return NextResponse.json({ conversations });
}

// POST /api/conversations — create new conversation
export async function POST() {
  const session = await getServerSession(authOptions);
  const userId = session?.user && "id" in session.user ? (session.user.id as string) : null;
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const conversation = await prisma.conversation.create({
    data: { userId },
  });

  return NextResponse.json(conversation, { status: 201 });
}
