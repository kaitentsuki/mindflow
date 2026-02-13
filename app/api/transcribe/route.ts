import { NextRequest, NextResponse } from "next/server";
import { transcribe } from "@/lib/stt";

// POST /api/transcribe — accept audio file, return transcript
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File | null;
    const language = formData.get("language") as string | null;

    if (!audioFile) {
      return NextResponse.json(
        { error: "No audio file provided" },
        { status: 400 }
      );
    }

    // Validate file size (max 25MB — Whisper limit)
    if (audioFile.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Audio file too large (max 25MB)" },
        { status: 413 }
      );
    }

    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await transcribe(buffer, audioFile.name, language || undefined);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Transcription error:", error);
    const message =
      error instanceof Error ? error.message : "Transcription failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
