import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const thought = await prisma.thought.findUnique({
    where: { id },
    select: { audioData: true, audioMime: true },
  });

  if (!thought?.audioData) {
    return NextResponse.json({ error: "No audio data" }, { status: 404 });
  }

  const buffer = Buffer.from(thought.audioData, "base64");
  const contentType = thought.audioMime || "audio/webm";
  const rangeHeader = request.headers.get("range");

  if (rangeHeader) {
    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (match) {
      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : buffer.length - 1;
      const chunk = buffer.subarray(start, end + 1);

      return new Response(chunk, {
        status: 206,
        headers: {
          "Content-Type": contentType,
          "Content-Range": `bytes ${start}-${end}/${buffer.length}`,
          "Content-Length": chunk.length.toString(),
          "Accept-Ranges": "bytes",
        },
      });
    }
  }

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": buffer.length.toString(),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
