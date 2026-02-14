import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseJSONImport, parseCSVImport, validateImportData } from "@/lib/import";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !("id" in session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id as string;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const text = await file.text();
  const fileName = file.name.toLowerCase();

  let parsed;
  try {
    if (fileName.endsWith(".json")) {
      parsed = parseJSONImport(text);
    } else if (fileName.endsWith(".csv")) {
      parsed = parseCSVImport(text);
    } else {
      // Try JSON first, fall back to CSV
      try {
        parsed = parseJSONImport(text);
      } catch {
        parsed = parseCSVImport(text);
      }
    }
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to parse file: ${err instanceof Error ? err.message : "Unknown error"}` },
      { status: 400 }
    );
  }

  const { valid, errors } = validateImportData(parsed);

  let imported = 0;
  for (const item of valid) {
    await prisma.thought.create({
      data: {
        userId,
        rawTranscript: item.rawTranscript || item.cleanedText || "",
        cleanedText: item.cleanedText || item.rawTranscript || "",
        summary: item.summary || null,
        type: (item.type as "task" | "idea" | "note" | "reminder" | "journal") || "note",
        priority: item.priority || 3,
        categories: item.categories || [],
        sentiment: item.sentiment ?? null,
        entities: item.entities || {},
        actionItems: item.actionItems || [],
        deadline: item.deadline ? new Date(item.deadline) : null,
        language: item.language || "cs",
        source: item.source || "import",
      },
    });
    imported++;
  }

  return NextResponse.json({ imported, errors });
}
