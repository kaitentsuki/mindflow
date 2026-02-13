import { NextRequest, NextResponse } from "next/server";

// POST /api/chat — stub: RAG conversational endpoint
export async function POST(request: NextRequest) {
  const { message } = await request.json();

  // TODO: Implement RAG pipeline — query embedding → pgvector search → Claude Sonnet
  return NextResponse.json({
    message,
    response:
      "Toto je stub odpověď. RAG chat bude implementován v Phase 2. Zeptal/a ses: " +
      message,
    sources: [],
  });
}
