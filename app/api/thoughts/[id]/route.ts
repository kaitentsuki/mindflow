import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/thoughts/:id
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const thought = await prisma.thought.findUnique({ where: { id } });

  if (!thought) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(thought);
}

// PATCH /api/thoughts/:id
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  // Determine snoozedUntil logic
  let snoozedUntilValue: Date | null | undefined = undefined;
  if (body.snoozedUntil !== undefined) {
    snoozedUntilValue = body.snoozedUntil ? new Date(body.snoozedUntil) : null;
  } else if (body.status === "snoozed") {
    // Default snooze to 1 hour if no explicit snoozedUntil
    snoozedUntilValue = new Date(Date.now() + 3600000);
  } else if (body.status !== undefined && body.status !== "snoozed") {
    // Clear snoozedUntil when moving away from snoozed
    snoozedUntilValue = null;
  }

  const thought = await prisma.thought.update({
    where: { id },
    data: {
      ...(body.cleanedText !== undefined && { cleanedText: body.cleanedText }),
      ...(body.summary !== undefined && { summary: body.summary }),
      ...(body.type !== undefined && { type: body.type }),
      ...(body.priority !== undefined && { priority: body.priority }),
      ...(body.categories !== undefined && { categories: body.categories }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.deadline !== undefined && {
        deadline: body.deadline ? new Date(body.deadline) : null,
      }),
      ...(body.status === "done" && { completedAt: new Date() }),
      ...(snoozedUntilValue !== undefined && { snoozedUntil: snoozedUntilValue }),
    },
  });

  return NextResponse.json(thought);
}

// DELETE /api/thoughts/:id
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.thought.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
