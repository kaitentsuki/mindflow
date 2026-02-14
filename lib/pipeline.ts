import { prisma } from "./db";
import {
  filterRelevance,
  extractEntities,
  isLLMAvailable,
  type ExtractionResult,
} from "./llm";
import { generateEmbedding } from "./embeddings";
import { createAndSendNotification, notificationExists } from "./notifications";

const RELEVANCE_THRESHOLD = 0.7;

export interface ProcessResult {
  thoughtId: string;
  relevant: boolean;
  confidence: number;
  extraction: ExtractionResult | null;
  embeddingGenerated: boolean;
  connectionsFound: number;
}

/**
 * Full processing pipeline for a transcript:
 * 1. Relevance filter (Haiku)
 * 2. Entity extraction (Sonnet)
 * 3. Embedding generation (OpenAI)
 * 4. Save to DB
 * 5. Find connections (pgvector similarity)
 */
export async function processTranscript(
  userId: string,
  rawTranscript: string,
  language: string
): Promise<ProcessResult> {
  // Step 1: Relevance filter
  const relevance = await filterRelevance(rawTranscript);
  const isRelevant = relevance.relevant && relevance.confidence >= RELEVANCE_THRESHOLD;

  let extraction: ExtractionResult | null = null;

  if (isRelevant && isLLMAvailable()) {
    // Step 2: Entity extraction (only for relevant transcripts)
    extraction = await extractEntities(rawTranscript, language);
  }

  // Step 3: Create thought in DB
  const thought = await prisma.thought.create({
    data: {
      userId,
      rawTranscript,
      cleanedText: extraction?.summary || rawTranscript,
      summary: extraction?.summary || null,
      type: extraction?.type || "note",
      priority: extraction?.priority || 3,
      categories: extraction?.categories || [],
      sentiment: extraction?.sentiment ?? null,
      entities: extraction?.entities || {},
      actionItems: extraction?.action_items || [],
      deadline: extraction?.deadline ? new Date(extraction.deadline) : null,
      language,
      source: "voice",
    },
  });

  // Step 4: Generate embedding
  const textForEmbedding = [
    extraction?.summary || "",
    rawTranscript,
  ]
    .filter(Boolean)
    .join(" ");

  const embedding = await generateEmbedding(textForEmbedding);
  let embeddingGenerated = false;

  if (embedding) {
    const vectorStr = `[${embedding.join(",")}]`;
    await prisma.$executeRawUnsafe(
      `UPDATE thoughts SET embedding = $1::vector WHERE id = $2::uuid`,
      vectorStr,
      thought.id
    );
    embeddingGenerated = true;
  }

  // Step 5: Find connections via pgvector similarity search
  let connectionsFound = 0;
  if (embeddingGenerated) {
    connectionsFound = await findConnections(thought.id, userId);
  }

  // Step 6: Notify about new connections
  if (connectionsFound > 0) {
    await notifyConnections(thought.id, userId, connectionsFound);
  }

  // Step 7: Auto-sync to Google Calendar if enabled and thought has deadline
  if (thought.deadline) {
    try {
      await autoSyncCalendar(thought.id, userId);
    } catch (err) {
      console.error("[pipeline] Google Calendar auto-sync failed:", err);
    }
  }

  return {
    thoughtId: thought.id,
    relevant: isRelevant,
    confidence: relevance.confidence,
    extraction,
    embeddingGenerated,
    connectionsFound,
  };
}

/**
 * Process an existing thought by ID (for background processing).
 * Runs entity extraction + embedding on an already-saved thought.
 */
export async function processExistingThought(
  thoughtId: string
): Promise<ProcessResult> {
  const thought = await prisma.thought.findUnique({
    where: { id: thoughtId },
  });

  if (!thought) {
    throw new Error(`Thought not found: ${thoughtId}`);
  }

  // Step 1: Relevance filter
  const relevance = await filterRelevance(thought.rawTranscript);
  const isRelevant = relevance.relevant && relevance.confidence >= RELEVANCE_THRESHOLD;

  let extraction: ExtractionResult | null = null;

  if (isRelevant && isLLMAvailable()) {
    // Step 2: Entity extraction
    extraction = await extractEntities(thought.rawTranscript, thought.language);

    // Update thought with extracted data
    await prisma.thought.update({
      where: { id: thoughtId },
      data: {
        cleanedText: extraction.summary || thought.rawTranscript,
        summary: extraction.summary,
        type: extraction.type,
        priority: extraction.priority,
        categories: extraction.categories,
        sentiment: extraction.sentiment,
        entities: extraction.entities,
        actionItems: extraction.action_items,
        deadline: extraction.deadline ? new Date(extraction.deadline) : null,
      },
    });
  }

  // Step 3: Generate embedding
  const textForEmbedding = [
    extraction?.summary || thought.summary || "",
    thought.rawTranscript,
  ]
    .filter(Boolean)
    .join(" ");

  const embedding = await generateEmbedding(textForEmbedding);
  let embeddingGenerated = false;

  if (embedding) {
    const vectorStr = `[${embedding.join(",")}]`;
    await prisma.$executeRawUnsafe(
      `UPDATE thoughts SET embedding = $1::vector WHERE id = $2::uuid`,
      vectorStr,
      thoughtId
    );
    embeddingGenerated = true;
  }

  // Step 4: Find connections
  let connectionsFound = 0;
  if (embeddingGenerated) {
    connectionsFound = await findConnections(thoughtId, thought.userId);
  }

  // Step 5: Notify about new connections
  if (connectionsFound > 0) {
    await notifyConnections(thoughtId, thought.userId, connectionsFound);
  }

  return {
    thoughtId,
    relevant: isRelevant,
    confidence: relevance.confidence,
    extraction,
    embeddingGenerated,
    connectionsFound,
  };
}

const CONNECTION_SIMILARITY_THRESHOLD = 0.82;
const CONNECTION_TOP_K = 5;

/**
 * Find semantically similar thoughts and create connections.
 */
async function findConnections(
  thoughtId: string,
  userId: string
): Promise<number> {
  const similar = await prisma.$queryRawUnsafe<
    Array<{ id: string; similarity: number }>
  >(
    `SELECT id, 1 - (embedding <=> (SELECT embedding FROM thoughts WHERE id = $1::uuid)) AS similarity
     FROM thoughts
     WHERE user_id = $2::uuid
       AND id != $1::uuid
       AND status != 'archived'
       AND embedding IS NOT NULL
     ORDER BY embedding <=> (SELECT embedding FROM thoughts WHERE id = $1::uuid)
     LIMIT $3`,
    thoughtId,
    userId,
    CONNECTION_TOP_K
  );

  const connections = similar.filter(
    (s) => s.similarity >= CONNECTION_SIMILARITY_THRESHOLD
  );

  for (const conn of connections) {
    // Ensure consistent ordering (smaller UUID first) to avoid duplicates
    const [a, b] =
      thoughtId < conn.id
        ? [thoughtId, conn.id]
        : [conn.id, thoughtId];

    await prisma.$executeRawUnsafe(
      `INSERT INTO thought_connections (id, thought_a_id, thought_b_id, similarity, connection_type)
       VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3, 'semantic')
       ON CONFLICT (thought_a_id, thought_b_id) DO UPDATE SET similarity = $3`,
      a,
      b,
      conn.similarity
    );
  }

  return connections.length;
}

/**
 * Send a notification when new connections are found for a thought.
 */
async function notifyConnections(
  thoughtId: string,
  userId: string,
  connectionsFound: number
): Promise<void> {
  try {
    const exists = await notificationExists(userId, thoughtId, "connection", 24);
    if (exists) return;

    const thought = await prisma.thought.findUnique({
      where: { id: thoughtId },
      select: { summary: true, cleanedText: true },
    });

    await createAndSendNotification({
      userId,
      thoughtId,
      type: "connection",
      title: `${connectionsFound} related thought${connectionsFound > 1 ? "s" : ""} found`,
      body: thought?.summary || thought?.cleanedText.slice(0, 100),
      url: `/library?highlight=${thoughtId}`,
    });
  } catch (err) {
    console.error("[pipeline] Failed to send connection notification:", err);
  }
}

/**
 * Auto-sync a thought to Google Calendar if user has enabled auto-sync.
 */
async function autoSyncCalendar(
  thoughtId: string,
  userId: string
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });
  const prefs = (user?.preferences as Record<string, unknown>) || {};
  if (!prefs.google_calendar_auto_sync) return;

  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
  });
  if (!account?.access_token) return;

  const thought = await prisma.thought.findUnique({
    where: { id: thoughtId },
  });
  if (!thought?.deadline || thought.calendarEventId) return;

  const { getCalendarClient, createCalendarEvent } = await import("./google-calendar");
  const client = getCalendarClient(account.access_token, account.refresh_token || "");
  const eventId = await createCalendarEvent(client, {
    summary: thought.summary || thought.cleanedText,
    deadline: thought.deadline.toISOString(),
    description: thought.cleanedText,
  });

  await prisma.thought.update({
    where: { id: thoughtId },
    data: { calendarEventId: eventId },
  });
}
