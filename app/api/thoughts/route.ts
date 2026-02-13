import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { processExistingThought } from "@/lib/pipeline";

async function getUserId(request: NextRequest): Promise<string | null> {
  // First check session
  const session = await getServerSession(authOptions);
  if (session?.user && "id" in session.user) {
    return session.user.id as string;
  }
  // Fallback: check body (for API/testing)
  return null;
}

// GET /api/thoughts — list thoughts with optional filters
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const status = searchParams.get("status") || "active";
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = parseInt(searchParams.get("offset") || "0");

  const userId = await getUserId(request);

  const where: Record<string, unknown> = {};
  if (userId) where.userId = userId;
  if (type) where.type = type;
  if (status) where.status = status;

  const [thoughts, total] = await Promise.all([
    prisma.thought.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.thought.count({ where }),
  ]);

  return NextResponse.json({ thoughts, total });
}

// POST /api/thoughts — create a new thought and trigger LLM pipeline
export async function POST(request: NextRequest) {
  const body = await request.json();

  // Get userId from session or body
  const sessionUserId = await getUserId(request);
  const userId = sessionUserId || body.userId;

  if (!userId) {
    return NextResponse.json(
      { error: "Not authenticated. Please log in." },
      { status: 401 }
    );
  }

  const thought = await prisma.thought.create({
    data: {
      userId,
      rawTranscript: body.rawTranscript,
      cleanedText: body.cleanedText || body.rawTranscript,
      summary: body.summary,
      type: body.type || "note",
      priority: body.priority || 3,
      categories: body.categories || [],
      sentiment: body.sentiment,
      entities: body.entities || {},
      actionItems: body.actionItems || [],
      deadline: body.deadline ? new Date(body.deadline) : null,
      language: body.language || "cs",
      source: body.source || "voice",
    },
  });

  // Trigger LLM pipeline in background (fire-and-forget)
  processExistingThought(thought.id).catch((err) => {
    console.error(`[pipeline] Failed to process thought ${thought.id}:`, err);
  });

  return NextResponse.json(thought, { status: 201 });
}
