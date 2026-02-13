import { NextRequest, NextResponse } from "next/server";
import { processExistingThought, processTranscript } from "@/lib/pipeline";

// POST /api/process — run LLM pipeline on a thought or raw transcript
export async function POST(request: NextRequest) {
  const body = await request.json();

  // Option 1: Process an existing thought by ID
  if (body.thoughtId) {
    try {
      const result = await processExistingThought(body.thoughtId);
      return NextResponse.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Processing failed";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  // Option 2: Process a raw transcript (creates a new thought)
  if (body.userId && body.rawTranscript) {
    const result = await processTranscript(
      body.userId,
      body.rawTranscript,
      body.language || "cs"
    );
    return NextResponse.json(result, { status: 201 });
  }

  return NextResponse.json(
    { error: "Provide either { thoughtId } or { userId, rawTranscript }" },
    { status: 400 }
  );
}
