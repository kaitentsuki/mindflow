import OpenAI from "openai";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

/**
 * Generate a 1536-dimension embedding using OpenAI text-embedding-3-small.
 * Returns null if OPENAI_API_KEY is not configured.
 */
export async function generateEmbedding(
  text: string
): Promise<number[] | null> {
  if (!openai) {
    return null;
  }

  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });

  return response.data[0].embedding;
}

export function isEmbeddingsAvailable(): boolean {
  return openai !== null;
}
