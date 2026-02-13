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
 * Transcribe audio using OpenAI Whisper API.
 * Falls back to a mock result if OPENAI_API_KEY is not set.
 */
export async function transcribe(
  audioBuffer: Buffer,
  filename: string,
  language?: string
): Promise<TranscriptResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.warn("OPENAI_API_KEY not set — returning mock transcript");
    return getMockTranscript();
  }

  const openai = new OpenAI({ apiKey });

  // Convert Buffer to a File object for the OpenAI SDK
  const uint8 = new Uint8Array(audioBuffer);
  const file = new File([uint8], filename, {
    type: getContentType(filename),
  });

  const response = await openai.audio.transcriptions.create({
    model: "whisper-1",
    file,
    language: language || undefined,
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
    // Whisper doesn't return overall confidence; use avg_logprob from segments as proxy
    confidence: estimateConfidence(response.segments),
  };
}

function getContentType(filename: string): string {
  if (filename.endsWith(".mp4") || filename.endsWith(".m4a")) {
    return "audio/mp4";
  }
  if (filename.endsWith(".wav")) return "audio/wav";
  if (filename.endsWith(".mp3")) return "audio/mpeg";
  return "audio/webm";
}

/**
 * Estimate confidence from Whisper segment avg_logprob values.
 * avg_logprob is typically -0.1 to -1.0; closer to 0 = higher confidence.
 */
function estimateConfidence(
  segments: Array<{ avg_logprob?: number }> | undefined
): number {
  if (!segments || segments.length === 0) return 0.85;

  const avgLogprobs = segments
    .map((s) => s.avg_logprob)
    .filter((v): v is number => v !== undefined);

  if (avgLogprobs.length === 0) return 0.85;

  const mean = avgLogprobs.reduce((a, b) => a + b, 0) / avgLogprobs.length;
  // Map log prob to 0-1 range: -0.0 → 1.0, -1.0 → ~0.37
  return Math.min(1, Math.max(0, Math.exp(mean)));
}

function getMockTranscript(): TranscriptResult {
  return {
    text: "Toto je ukázkový přepis z hlasového záznamu. OPENAI_API_KEY není nastaven, takže se používá mock odpověď.",
    language: "cs",
    segments: [
      { start: 0, end: 3.5, text: "Toto je ukázkový přepis z hlasového záznamu." },
      {
        start: 3.5,
        end: 7.0,
        text: "OPENAI_API_KEY není nastaven, takže se používá mock odpověď.",
      },
    ],
    confidence: 0.95,
  };
}
