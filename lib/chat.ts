import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "./db";
import { generateEmbedding } from "./embeddings";

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

interface RAGSource {
  thoughtId: string;
  summary: string;
  similarity: number;
}

// Get RAG context by finding relevant thoughts via pgvector
export async function getRAGContext(userId: string, query: string): Promise<RAGSource[]> {
  const embedding = await generateEmbedding(query);
  if (!embedding) return [];

  const vectorStr = `[${embedding.join(",")}]`;
  const results = await prisma.$queryRawUnsafe<Array<{
    id: string;
    summary: string | null;
    cleaned_text: string;
    similarity: number;
  }>>(
    `SELECT id, summary, cleaned_text, 1 - (embedding <=> $1::vector) AS similarity
     FROM thoughts
     WHERE user_id = $2::uuid AND embedding IS NOT NULL AND status != 'archived'
     ORDER BY embedding <=> $1::vector
     LIMIT 5`,
    vectorStr,
    userId
  );

  return results.map(r => ({
    thoughtId: r.id,
    summary: r.summary || r.cleaned_text.slice(0, 200),
    similarity: r.similarity,
  }));
}

// Generate RAG streaming response - returns async iterator of SSE chunks
export async function* generateRAGResponse(
  userId: string,
  message: string,
  conversationId: string,
): AsyncGenerator<string> {
  // 1. Get RAG context
  const sources = await getRAGContext(userId, message);

  // 2. Emit sources first
  yield `data: ${JSON.stringify({ type: "sources", sources })}\n\n`;

  // 3. Build conversation history from DB
  const history = await prisma.chatMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: 20,
  });

  // 4. Build system prompt with RAG context
  const contextText = sources.length > 0
    ? sources.map((s, i) => `[${i + 1}] ${s.summary}`).join("\n")
    : "No relevant thoughts found.";

  const systemPrompt = `You are MindFlow, an AI assistant that helps users manage their thoughts, tasks, and ideas. You have access to the user's captured thoughts.

Relevant context from user's thoughts:
${contextText}

Rules:
- Answer based on the user's thoughts when relevant
- If you reference a thought, mention its content naturally
- If no relevant thoughts found, still try to be helpful
- Be concise and helpful
- Respond in the same language the user uses`;

  // 5. Build messages array from history
  const messages: Array<{ role: "user" | "assistant"; content: string }> = history.map(m => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
  messages.push({ role: "user", content: message });

  if (!anthropic) {
    const fallback = "LLM not configured. Set ANTHROPIC_API_KEY to enable chat.";
    yield `data: ${JSON.stringify({ type: "text", content: fallback })}\n\n`;
    yield `data: ${JSON.stringify({ type: "done" })}\n\n`;
    return;
  }

  // 6. Stream from Claude
  const stream = anthropic.messages.stream({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  });

  let fullResponse = "";

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      const chunk = event.delta.text;
      fullResponse += chunk;
      yield `data: ${JSON.stringify({ type: "text", content: chunk })}\n\n`;
    }
  }

  // 7. Save assistant message to DB
  await prisma.chatMessage.create({
    data: {
      conversationId,
      role: "assistant",
      content: fullResponse,
      sources: sources.map(s => ({ thoughtId: s.thoughtId, summary: s.summary })),
    },
  });

  yield `data: ${JSON.stringify({ type: "done" })}\n\n`;
}

// Auto-generate conversation title using Haiku
export async function generateTitle(message: string, response: string): Promise<string> {
  if (!anthropic) return message.slice(0, 50);

  try {
    const result = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 50,
      messages: [{
        role: "user",
        content: `Generate a very short title (3-6 words) for a conversation that starts with this exchange:\nUser: ${message}\nAssistant: ${response.slice(0, 200)}\n\nRespond with ONLY the title text, nothing else.`,
      }],
    });
    const text = result.content[0].type === "text" ? result.content[0].text : "";
    return text.trim().slice(0, 100);
  } catch {
    return message.slice(0, 50);
  }
}
