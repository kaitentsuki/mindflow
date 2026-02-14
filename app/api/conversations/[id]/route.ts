import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/conversations/:id — get conversation with all messages
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const userId = session?.user && "id" in session.user ? (session.user.id as string) : null;
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const conversation = await prisma.conversation.findFirst({
    where: { id, userId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(conversation);
}

// DELETE /api/conversations/:id
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const userId = session?.user && "id" in session.user ? (session.user.id as string) : null;
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  await prisma.conversation.deleteMany({
    where: { id, userId },
  });

  return NextResponse.json({ deleted: true });
}
