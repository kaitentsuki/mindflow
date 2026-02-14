import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hybridSearch } from "@/lib/search";

async function getUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (session?.user && "id" in session.user) {
    return session.user.id as string;
  }
  return null;
}

// POST /api/search
export async function POST(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Not authenticated. Please log in." },
      { status: 401 }
    );
  }

  const body = await request.json();
  const { query, type, priority, category, dateFrom, dateTo, limit } = body;

  if (!query || typeof query !== "string") {
    return NextResponse.json(
      { error: "Missing required field: query" },
      { status: 400 }
    );
  }

  const results = await hybridSearch({
    userId,
    query,
    type,
    priority,
    category,
    dateFrom,
    dateTo,
    limit,
  });

  return NextResponse.json({ results, query, total: results.length });
}

// GET /api/search?query=...&type=...&priority=...&category=...&dateFrom=...&dateTo=...&limit=...
export async function GET(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Not authenticated. Please log in." },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query");

  if (!query) {
    return NextResponse.json(
      { error: "Missing required query parameter: query" },
      { status: 400 }
    );
  }

  const type = searchParams.get("type") || undefined;
  const priorityRaw = searchParams.get("priority");
  const priority = priorityRaw ? parseInt(priorityRaw, 10) : undefined;
  const category = searchParams.get("category") || undefined;
  const dateFrom = searchParams.get("dateFrom") || undefined;
  const dateTo = searchParams.get("dateTo") || undefined;
  const limitRaw = searchParams.get("limit");
  const limit = limitRaw ? parseInt(limitRaw, 10) : undefined;

  const results = await hybridSearch({
    userId,
    query,
    type,
    priority,
    category,
    dateFrom,
    dateTo,
    limit,
  });

  return NextResponse.json({ results, query, total: results.length });
}
