import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { thoughtsToJSON, thoughtsToCSV, thoughtsToMarkdown, type ThoughtExport } from "@/lib/export";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !("id" in session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id as string;

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") || "json";
  const type = searchParams.get("type");
  const status = searchParams.get("status");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  const where: Record<string, unknown> = { userId };
  if (type) where.type = type;
  if (status) where.status = status;
  if (dateFrom || dateTo) {
    const createdAt: Record<string, Date> = {};
    if (dateFrom) createdAt.gte = new Date(dateFrom);
    if (dateTo) createdAt.lte = new Date(dateTo);
    where.createdAt = createdAt;
  }

  const thoughts = await prisma.thought.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  const exported: ThoughtExport[] = thoughts.map((t) => ({
    id: t.id,
    type: t.type,
    priority: t.priority,
    summary: t.summary,
    cleanedText: t.cleanedText,
    rawTranscript: t.rawTranscript,
    status: t.status,
    categories: t.categories,
    sentiment: t.sentiment,
    entities: (t.entities as Record<string, string[]>) || {},
    actionItems: t.actionItems,
    deadline: t.deadline?.toISOString() || null,
    language: t.language,
    source: t.source,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));

  let content: string;
  let contentType: string;
  let extension: string;

  switch (format) {
    case "csv":
      content = thoughtsToCSV(exported);
      contentType = "text/csv; charset=utf-8";
      extension = "csv";
      break;
    case "md":
      content = thoughtsToMarkdown(exported);
      contentType = "text/markdown; charset=utf-8";
      extension = "md";
      break;
    default:
      content = thoughtsToJSON(exported);
      contentType = "application/json; charset=utf-8";
      extension = "json";
      break;
  }

  const date = new Date().toISOString().split("T")[0];
  return new NextResponse(content, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="mindflow-export-${date}.${extension}"`,
    },
  });
}
