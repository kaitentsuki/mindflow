import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createTodoistTask } from "@/lib/todoist";

// POST — Export thought to Todoist
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

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });
  const prefs = (user?.preferences as Record<string, unknown>) || {};
  const todoistToken = prefs.todoist_api_token as string | undefined;

  if (!todoistToken) {
    return NextResponse.json(
      { error: "Todoist API token not configured. Go to Settings to add it." },
      { status: 400 }
    );
  }

  const result = await createTodoistTask(todoistToken, {
    content: thought.summary || thought.cleanedText,
    description: thought.cleanedText,
    dueDate: thought.deadline?.toISOString(),
    priority: thought.priority,
  });

  await prisma.thought.update({
    where: { id: thoughtId },
    data: { todoistTaskId: result.id },
  });

  return NextResponse.json({ todoistTaskId: result.id });
}
