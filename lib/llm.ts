import Anthropic from "@anthropic-ai/sdk";

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

export interface RelevanceResult {
  relevant: boolean;
  confidence: number;
}

export interface ExtractionResult {
  type: "task" | "idea" | "note" | "reminder" | "journal";
  priority: number;
  categories: string[];
  entities: {
    people: string[];
    places: string[];
    projects: string[];
  };
  deadline: string | null;
  sentiment: number;
  action_items: string[];
  summary: string;
}

/**
 * Relevance filter using Claude Haiku.
 * Determines whether a transcript contains a thought worth saving.
 */
export async function filterRelevance(
  transcript: string
): Promise<RelevanceResult> {
  if (!anthropic) {
    return { relevant: true, confidence: 0.5 };
  }

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    messages: [
      {
        role: "user",
        content: `Evaluate whether the following speech transcript contains a thought, task, idea, reminder, or piece of information worth saving. Filter out small talk, repetition, incoherent fragments, and filler speech.

Transcript: "${transcript}"

Respond ONLY with a valid JSON object:
{"relevant": boolean, "confidence": number}

Where confidence is a float from 0.0 to 1.0 indicating how confident you are that this transcript is relevant and worth saving.`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { relevant: true, confidence: 0.5 };
    }
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      relevant: Boolean(parsed.relevant),
      confidence: Number(parsed.confidence) || 0.5,
    };
  } catch {
    return { relevant: true, confidence: 0.5 };
  }
}

/**
 * Entity extraction using Claude Sonnet.
 * Extracts structured data from a transcript.
 */
export async function extractEntities(
  transcript: string,
  language: string
): Promise<ExtractionResult> {
  if (!anthropic) {
    return {
      type: "note",
      priority: 3,
      categories: [],
      entities: { people: [], places: [], projects: [] },
      deadline: null,
      sentiment: 0,
      action_items: [],
      summary: transcript.slice(0, 200),
    };
  }

  const currentDate = new Date().toISOString().split("T")[0];

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Analyze the following speech transcript and extract structured data.
Today's date: ${currentDate}
Language of transcript: ${language}

Transcript: "${transcript}"

Respond ONLY with a valid JSON object following this exact schema:
{
  "type": "task" | "idea" | "note" | "reminder" | "journal",
  "priority": 1-5,
  "categories": ["string"],
  "entities": {
    "people": ["string"],
    "places": ["string"],
    "projects": ["string"]
  },
  "deadline": "ISO datetime string or null",
  "sentiment": -1.0 to 1.0,
  "action_items": ["string"],
  "summary": "1-2 sentence summary"
}

Rules:
- type: Choose the most fitting type. "task" for actionable items, "idea" for creative thoughts, "reminder" for time-sensitive reminders, "journal" for personal reflections, "note" for everything else.
- priority: 1 = lowest, 5 = highest urgency/importance
- categories: Generate relevant category labels (e.g., "work", "health", "project-X")
- entities: Extract mentioned people, places, and projects/topics
- deadline: Parse relative dates ("tomorrow", "next week", "Friday") into ISO datetime. null if no deadline mentioned.
- sentiment: -1.0 (very negative) to 1.0 (very positive), 0 = neutral
- action_items: Concrete steps to take, if any
- summary: Brief 1-2 sentence summary of the transcript content`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }
    const parsed = JSON.parse(jsonMatch[0]);

    const validTypes = ["task", "idea", "note", "reminder", "journal"] as const;
    const type = validTypes.includes(parsed.type) ? parsed.type : "note";

    return {
      type,
      priority: Math.min(5, Math.max(1, Number(parsed.priority) || 3)),
      categories: Array.isArray(parsed.categories) ? parsed.categories : [],
      entities: {
        people: Array.isArray(parsed.entities?.people)
          ? parsed.entities.people
          : [],
        places: Array.isArray(parsed.entities?.places)
          ? parsed.entities.places
          : [],
        projects: Array.isArray(parsed.entities?.projects)
          ? parsed.entities.projects
          : [],
      },
      deadline: parsed.deadline || null,
      sentiment: Number(parsed.sentiment) || 0,
      action_items: Array.isArray(parsed.action_items)
        ? parsed.action_items
        : [],
      summary: String(parsed.summary || transcript.slice(0, 200)),
    };
  } catch {
    return {
      type: "note",
      priority: 3,
      categories: [],
      entities: { people: [], places: [], projects: [] },
      deadline: null,
      sentiment: 0,
      action_items: [],
      summary: transcript.slice(0, 200),
    };
  }
}

export function isLLMAvailable(): boolean {
  return anthropic !== null;
}
