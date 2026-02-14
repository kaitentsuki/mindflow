import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateInsights } from "@/lib/insights";

// GET /api/insights — get AI-generated insights
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !("id" in session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id as string;

  const insights = await generateInsights(userId);
  return NextResponse.json({ insights });
}
