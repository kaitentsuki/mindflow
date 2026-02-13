import { NextRequest, NextResponse } from "next/server";

// POST /api/search — stub: semantic search
export async function POST(request: NextRequest) {
  const { query } = await request.json();

  // TODO: Implement embedding generation + pgvector similarity search
  return NextResponse.json({
    query,
    results: [
      {
        id: "mock-1",
        summary: "Ukázkový výsledek vyhledávání",
        type: "note",
        similarity: 0.89,
      },
    ],
    message: "Stub endpoint — semantic search bude implementován v Phase 2",
  });
}
