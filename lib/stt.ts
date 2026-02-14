import { createClient } from "@deepgram/sdk";
import OpenAI from "openai";

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface TranscriptResult {
  text: string;
  language: string;
  segments: TranscriptSegment[];
  confidence: number;
}

/**
 * Transcribe audio. Priority:
 * 1. Deepgram Nova-3 (primary — best Czech support)
 * 2. OpenAI gpt-4o-transcribe (fallback)
 * 3. Mock (no API keys)
 */
export async function transcribe(
  audioBuffer: Buffer,
  filename: string,
  language?: string
): Promise<TranscriptResult> {
  const start = Date.now();

  // Try Deepgram first
  if (process.env.DEEPGRAM_API_KEY) {
    try {
      console.log(`[stt] Using Deepgram Nova-3 | language=${language || "cs"} | audioSize=${audioBuffer.length} bytes`);
      const result = await transcribeWithDeepgram(audioBuffer, language);
      console.log(`[stt] Deepgram OK | ${Date.now() - start}ms | confidence=${result.confidence.toFixed(2)} | lang=${result.language} | text="${result.text.slice(0, 80)}..."`);
      return result;
    } catch (err) {
      console.error("[stt] Deepgram failed, falling back to OpenAI:", err);
    }
  }

  // Fallback to OpenAI
  if (process.env.OPENAI_API_KEY) {
    const model = process.env.STT_MODEL || "gpt-4o-transcribe";
    console.log(`[stt] Using OpenAI ${model} (fallback) | language=${language || "auto"}`);
    const result = await transcribeWithOpenAI(audioBuffer, filename, language);
    console.log(`[stt] OpenAI OK | ${Date.now() - start}ms | confidence=${result.confidence.toFixed(2)} | text="${result.text.slice(0, 80)}..."`);
    return result;
  }

  console.warn("[stt] No STT API key set — returning mock transcript");
  return getMockTranscript();
}

// ── Deepgram Nova-3 ─────────────────────────────────────────────────

async function transcribeWithDeepgram(
  audioBuffer: Buffer,
  language: string | undefined,
): Promise<TranscriptResult> {
  const deepgram = createClient(process.env.DEEPGRAM_API_KEY!);

  const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
    audioBuffer,
    {
      model: "nova-3",
      language: language || "cs",
      smart_format: true,
      punctuate: true,
      paragraphs: true,
    },
  );

  if (error) {
    throw new Error(`Deepgram error: ${error.message}`);
  }

  const channel = result.results.channels[0];
  const alt = channel.alternatives[0];

  // Build segments from paragraphs → sentences
  const segments: TranscriptSegment[] = [];
  const paragraphs = alt.paragraphs?.paragraphs;
  if (paragraphs) {
    for (const para of paragraphs) {
      for (const sentence of para.sentences) {
        segments.push({
          start: sentence.start,
          end: sentence.end,
          text: sentence.text,
        });
      }
    }
  }

  return {
    text: alt.transcript,
    language: channel.detected_language || language || "cs",
    segments,
    confidence: alt.confidence,
  };
}

// ── OpenAI (fallback) ───────────────────────────────────────────────

async function transcribeWithOpenAI(
  audioBuffer: Buffer,
  filename: string,
  language: string | undefined,
): Promise<TranscriptResult> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const uint8 = new Uint8Array(audioBuffer);
  const file = new File([uint8], filename, {
    type: getContentType(filename),
  });

  const model = process.env.STT_MODEL || "gpt-4o-transcribe";

  if (model.startsWith("gpt-4o")) {
    const prompt = language === "cs"
      ? "Přepiš přesně co říkám v češtině. Zachovej diakritiku."
      : language === "en"
        ? "Transcribe exactly what I say in English."
        : undefined;

    const response = await openai.audio.transcriptions.create({
      model,
      file,
      language: language || undefined,
      prompt,
    });

    return {
      text: response.text,
      language: language || "cs",
      segments: [],
      confidence: 0.95,
    };
  }

  // whisper-1
  const prompt = language === "cs"
    ? "Přepiš přesně co říkám v češtině. Zachovej háčky a čárky."
    : undefined;

  const response = await openai.audio.transcriptions.create({
    model: "whisper-1",
    file,
    language: language || undefined,
    prompt,
    response_format: "verbose_json",
    timestamp_granularities: ["segment"],
  });

  const segments: TranscriptSegment[] = (response.segments ?? []).map(
    (seg) => ({
      start: seg.start,
      end: seg.end,
      text: seg.text.trim(),
    })
  );

  return {
    text: response.text,
    language: response.language || language || "cs",
    segments,
    confidence: estimateConfidence(response.segments),
  };
}

// ── Helpers ─────────────────────────────────────────────────────────

function getContentType(filename: string): string {
  if (filename.endsWith(".mp4") || filename.endsWith(".m4a")) return "audio/mp4";
  if (filename.endsWith(".wav")) return "audio/wav";
  if (filename.endsWith(".mp3")) return "audio/mpeg";
  return "audio/webm";
}

function estimateConfidence(
  segments: Array<{ avg_logprob?: number }> | undefined
): number {
  if (!segments || segments.length === 0) return 0.85;
  const avgLogprobs = segments
    .map((s) => s.avg_logprob)
    .filter((v): v is number => v !== undefined);
  if (avgLogprobs.length === 0) return 0.85;
  const mean = avgLogprobs.reduce((a, b) => a + b, 0) / avgLogprobs.length;
  return Math.min(1, Math.max(0, Math.exp(mean)));
}

function getMockTranscript(): TranscriptResult {
  return {
    text: "Toto je ukázkový přepis z hlasového záznamu. Žádný STT API klíč není nastaven.",
    language: "cs",
    segments: [
      { start: 0, end: 3.5, text: "Toto je ukázkový přepis z hlasového záznamu." },
      { start: 3.5, end: 7.0, text: "Žádný STT API klíč není nastaven." },
    ],
    confidence: 0.95,
  };
}
