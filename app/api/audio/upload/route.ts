import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !("id" in session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const audioFile = formData.get("audio") as File | null;
  const thoughtId = formData.get("thoughtId") as string | null;

  if (!audioFile || !thoughtId) {
    return NextResponse.json(
      { error: "Missing audio file or thoughtId" },
      { status: 400 }
    );
  }

  // Verify thought belongs to user
  const thought = await prisma.thought.findFirst({
    where: { id: thoughtId, userId: session.user.id as string },
  });

  if (!thought) {
    return NextResponse.json({ error: "Thought not found" }, { status: 404 });
  }

  // Convert blob to base64
  const arrayBuffer = await audioFile.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const mimeType = audioFile.type || "audio/webm";

  await prisma.thought.update({
    where: { id: thoughtId },
    data: {
      audioData: base64,
      audioMime: mimeType.substring(0, 50),
      audioUrl: `/api/audio/${thoughtId}`,
    },
  });

  return NextResponse.json({ audioUrl: `/api/audio/${thoughtId}` });
}
