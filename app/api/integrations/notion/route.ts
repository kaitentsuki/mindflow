import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createNotionPage } from "@/lib/notion";

// POST — Export thought to Notion
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
  const notionToken = prefs.notion_api_token as string | undefined;
  const notionDbId = prefs.notion_database_id as string | undefined;

  if (!notionToken || !notionDbId) {
    return NextResponse.json(
      { error: "Notion API token and database ID not configured. Go to Settings to add them." },
      { status: 400 }
    );
  }

  const result = await createNotionPage(notionToken, notionDbId, {
    summary: thought.summary || thought.cleanedText,
    type: thought.type,
    categories: thought.categories,
    content: thought.cleanedText,
  });

  await prisma.thought.update({
    where: { id: thoughtId },
    data: { notionPageId: result.id },
  });

  return NextResponse.json({ notionPageId: result.id, notionUrl: result.url });
}
