import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { ThoughtDetail } from "@/components/ThoughtDetail";

export default async function ThoughtPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const thought = await prisma.thought.findUnique({
    where: { id },
  });

  if (!thought) notFound();

  // Get connections (both directions)
  const connections = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      summary: string | null;
      cleaned_text: string;
      type: string;
      priority: number;
      categories: string[];
      status: string;
      deadline: string | null;
      created_at: string;
      similarity: number;
    }>
  >(
    `SELECT t.id, t.summary, t.cleaned_text, t.type, t.priority, t.categories, t.status, t.deadline, t.created_at,
            tc.similarity
     FROM thought_connections tc
     JOIN thoughts t ON (
       CASE WHEN tc.thought_a_id = $1::uuid THEN tc.thought_b_id ELSE tc.thought_a_id END = t.id
     )
     WHERE (tc.thought_a_id = $1::uuid OR tc.thought_b_id = $1::uuid)
       AND t.status != 'archived'
     ORDER BY tc.similarity DESC
     LIMIT 10`,
    id
  );

  return (
    <ThoughtDetail
      thought={{
        id: thought.id,
        type: thought.type,
        priority: thought.priority,
        summary: thought.summary,
        cleanedText: thought.cleanedText,
        rawTranscript: thought.rawTranscript,
        status: thought.status,
        categories: thought.categories,
        deadline: thought.deadline?.toISOString() ?? null,
        createdAt: thought.createdAt.toISOString(),
        updatedAt: thought.updatedAt.toISOString(),
        sentiment: thought.sentiment,
        entities: thought.entities as Record<string, string[]>,
        actionItems: thought.actionItems,
        language: thought.language,
        source: thought.source,
        snoozedUntil: thought.snoozedUntil?.toISOString() ?? null,
        completedAt: thought.completedAt?.toISOString() ?? null,
        audioUrl: thought.audioData ? `/api/audio/${thought.id}` : null,
        audioMime: thought.audioMime ?? null,
        calendarEventId: thought.calendarEventId ?? null,
        todoistTaskId: thought.todoistTaskId ?? null,
        notionPageId: thought.notionPageId ?? null,
      }}
      connections={connections.map((c) => ({
        id: c.id,
        type: c.type,
        priority: c.priority,
        summary: c.summary,
        cleanedText: c.cleaned_text,
        status: c.status,
        categories: c.categories || [],
        deadline: c.deadline,
        createdAt: c.created_at,
        similarity: c.similarity,
      }))}
    />
  );
}
