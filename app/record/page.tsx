"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { AudioCapture } from "@/lib/audio";
import { ContinuousRecording } from "@/lib/continuous-recording";
import { WaveformVisualizer } from "@/components/WaveformVisualizer";

type RecordingMode = "single" | "continuous";

type PageStatus =
  | "idle"
  | "recording"
  | "paused"
  | "uploading"
  | "transcribing"
  | "saving"
  | "done"
  | "error";

interface TranscriptResult {
  text: string;
  language: string;
  segments: Array<{ start: number; end: number; text: string }>;
  confidence: number;
}

interface ContinuousSegment {
  id: number;
  text: string | null;
  status: "transcribing" | "done" | "error";
  duration: number;
}

export default function RecordPage() {
  const [status, setStatus] = useState<PageStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptResult | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [language, setLanguage] = useState("cs");
  const [mode, setMode] = useState<RecordingMode>("single");
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  const [segments, setSegments] = useState<ContinuousSegment[]>([]);
  const captureRef = useRef<AudioCapture | null>(null);
  const continuousRef = useRef<ContinuousRecording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const levelRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioBlobRef = useRef<Blob | null>(null);
  const segmentIdRef = useRef(0);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      captureRef.current?.cancel();
      continuousRef.current?.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      if (levelRef.current) clearInterval(levelRef.current);
    };
  }, []);

  const startTimers = useCallback(() => {
    const capture = captureRef.current;
    if (!capture) return;

    timerRef.current = setInterval(() => {
      setElapsed(capture.getElapsedMs());
    }, 100);

    levelRef.current = setInterval(() => {
      setAudioLevel(capture.getAudioLevel());
    }, 50);
  }, []);

  const stopTimers = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (levelRef.current) {
      clearInterval(levelRef.current);
      levelRef.current = null;
    }
  }, []);

  const uploadAudio = async (blob: Blob, thoughtId: string) => {
    try {
      const formData = new FormData();
      const ext = blob.type.includes("mp4") ? "m4a" : "webm";
      formData.append("audio", blob, `recording.${ext}`);
      formData.append("thoughtId", thoughtId);
      await fetch("/api/audio/upload", { method: "POST", body: formData });
    } catch {
      console.error("[record] Failed to upload audio data");
    }
  };

  // --- Single-shot mode ---
  const handleStart = async () => {
    setError(null);
    setTranscript(null);
    setPermissionDenied(false);
    audioBlobRef.current = null;

    const capture = new AudioCapture();
    captureRef.current = capture;

    try {
      await capture.start();
      setAnalyserNode(capture.getAnalyser());
      setStatus("recording");
      startTimers();
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setPermissionDenied(true);
        setError("Microphone access denied. Please allow microphone access in your browser settings.");
      } else {
        setError("Failed to start recording. Please check your microphone.");
      }
      setStatus("error");
    }
  };

  const handlePause = () => {
    const capture = captureRef.current;
    if (!capture) return;

    if (capture.state === "recording") {
      capture.pause();
      setStatus("paused");
      stopTimers();
      setElapsed(capture.getElapsedMs());
    } else if (capture.state === "paused") {
      capture.resume();
      setStatus("recording");
      startTimers();
    }
  };

  const handleStop = async () => {
    const capture = captureRef.current;
    if (!capture) return;

    stopTimers();

    try {
      setStatus("uploading");
      const result = await capture.stop();
      setAnalyserNode(null);
      audioBlobRef.current = result.blob;

      console.log(`[record] Audio: ${result.mimeType} | ${(result.blob.size / 1024).toFixed(1)} KB | ${(result.durationMs / 1000).toFixed(1)}s`);

      // Upload to transcribe API
      setStatus("transcribing");
      const formData = new FormData();
      const ext = result.mimeType.includes("mp4") ? "m4a" : "webm";
      formData.append("audio", result.blob, `recording.${ext}`);
      formData.append("language", language);

      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Transcription failed");
      }

      const transcriptData: TranscriptResult = await response.json();
      setTranscript(transcriptData);

      // Auto-create thought from transcript
      if (transcriptData.text.trim()) {
        setStatus("saving");
        const thoughtResponse = await fetch("/api/thoughts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rawTranscript: transcriptData.text,
            language: transcriptData.language || language,
            source: "voice",
            audioDuration: result.durationMs / 1000,
          }),
        });

        if (thoughtResponse.ok) {
          const thoughtData = await thoughtResponse.json();
          // Upload audio data to the thought
          if (audioBlobRef.current && thoughtData.id) {
            await uploadAudio(audioBlobRef.current, thoughtData.id);
          }
        } else {
          console.error("Failed to save thought, but transcript is available");
        }
      }

      setStatus("done");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      setStatus("error");
    }
  };

  const handleCancel = () => {
    captureRef.current?.cancel();
    stopTimers();
    setAnalyserNode(null);
    setStatus("idle");
    setElapsed(0);
    setAudioLevel(0);
  };

  // --- Continuous mode ---
  const handleContinuousStart = async () => {
    setError(null);
    setSegments([]);
    setPermissionDenied(false);

    const onSegment = async (blob: Blob, duration: number) => {
      const id = ++segmentIdRef.current;
      setSegments((prev) => [
        ...prev,
        { id, text: null, status: "transcribing", duration },
      ]);

      try {
        const formData = new FormData();
        const ext = blob.type.includes("mp4") ? "m4a" : "webm";
        formData.append("audio", blob, `segment-${id}.${ext}`);
        formData.append("language", language);

        const response = await fetch("/api/transcribe", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) throw new Error("Transcription failed");

        const data: TranscriptResult = await response.json();

        if (data.text.trim()) {
          // Save as thought
          const thoughtRes = await fetch("/api/thoughts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              rawTranscript: data.text,
              language: data.language || language,
              source: "voice",
              audioDuration: duration / 1000,
            }),
          });

          if (thoughtRes.ok) {
            const thoughtData = await thoughtRes.json();
            await uploadAudio(blob, thoughtData.id);
          }
        }

        setSegments((prev) =>
          prev.map((s) =>
            s.id === id
              ? { ...s, text: data.text || "(empty)", status: "done" as const }
              : s
          )
        );
      } catch {
        setSegments((prev) =>
          prev.map((s) =>
            s.id === id ? { ...s, text: "Error", status: "error" as const } : s
          )
        );
      }
    };

    const continuous = new ContinuousRecording(onSegment, language);
    continuousRef.current = continuous;

    try {
      await continuous.start();
      setAnalyserNode(continuous.getAnalyser());
      setStatus("recording");
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setPermissionDenied(true);
        setError("Microphone access denied.");
      } else {
        setError("Failed to start continuous recording.");
      }
      setStatus("error");
    }
  };

  const handleContinuousStop = () => {
    continuousRef.current?.stop();
    continuousRef.current = null;
    setAnalyserNode(null);
    setStatus(segments.length > 0 ? "done" : "idle");
  };

  const handleReset = () => {
    setStatus("idle");
    setError(null);
    setTranscript(null);
    setElapsed(0);
    setAudioLevel(0);
    setSegments([]);
    setAnalyserNode(null);
    audioBlobRef.current = null;
  };

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const isRecording = status === "recording" || status === "paused";
  const isProcessing =
    status === "uploading" || status === "transcribing" || status === "saving";

  return (
    <div className="mx-auto max-w-2xl text-center">
      <h1 className="mb-2 text-3xl font-bold text-zinc-900 dark:text-zinc-100">
        Record
      </h1>
      <p className="mb-6 text-zinc-500 dark:text-zinc-400">
        Tap the button to start capturing your thoughts.
      </p>

      {/* Mode toggle + Language toggle */}
      <div className="mb-8 flex flex-wrap items-center justify-center gap-3">
        {/* Recording mode toggle */}
        <div className="inline-flex items-center rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-700">
          <button
            onClick={() => setMode("single")}
            disabled={isRecording || isProcessing}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              mode === "single"
                ? "bg-indigo-600 text-white"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            } disabled:opacity-50`}
          >
            Single
          </button>
          <button
            onClick={() => setMode("continuous")}
            disabled={isRecording || isProcessing}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              mode === "continuous"
                ? "bg-indigo-600 text-white"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            } disabled:opacity-50`}
          >
            Continuous
          </button>
        </div>

        {/* Language toggle */}
        <div className="inline-flex items-center rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-700">
          <button
            onClick={() => setLanguage("cs")}
            disabled={isRecording || isProcessing}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              language === "cs"
                ? "bg-indigo-600 text-white"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            } disabled:opacity-50`}
          >
            CZ
          </button>
          <button
            onClick={() => setLanguage("en")}
            disabled={isRecording || isProcessing}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              language === "en"
                ? "bg-indigo-600 text-white"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            } disabled:opacity-50`}
          >
            EN
          </button>
        </div>
      </div>

      <div className="flex flex-col items-center gap-8">
        {/* Waveform visualizer */}
        {(isRecording || isProcessing) && (
          <div className="w-full rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
            <WaveformVisualizer
              analyser={analyserNode}
              isActive={status === "recording"}
            />
          </div>
        )}

        {/* Record button */}
        <div className="relative">
          {/* Audio level ring */}
          {status === "recording" && (
            <div
              className="absolute inset-0 rounded-full bg-indigo-500/20 transition-transform"
              style={{
                transform: `scale(${1 + (audioLevel / 255) * 0.5})`,
              }}
            />
          )}

          <button
            onClick={
              status === "idle" || status === "done" || status === "error"
                ? mode === "continuous"
                  ? handleContinuousStart
                  : handleStart
                : mode === "continuous"
                  ? handleContinuousStop
                  : handleStop
            }
            disabled={isProcessing}
            className={`relative flex h-32 w-32 items-center justify-center rounded-full transition-all disabled:opacity-50 ${
              isRecording
                ? "bg-red-500 shadow-lg shadow-red-500/30"
                : isProcessing
                  ? "bg-zinc-400 shadow-lg"
                  : "bg-indigo-600 shadow-lg shadow-indigo-500/30 hover:bg-indigo-700"
            } ${status === "recording" ? "animate-pulse" : ""}`}
          >
            <svg
              className="h-12 w-12 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              {isRecording ? (
                <rect
                  x="6"
                  y="6"
                  width="12"
                  height="12"
                  rx="2"
                  fill="currentColor"
                />
              ) : isProcessing ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6v6l4 2"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              )}
            </svg>
          </button>
        </div>

        {/* Status text + elapsed time */}
        <div className="flex flex-col items-center gap-1">
          {isRecording && mode === "single" && (
            <p className="text-2xl font-mono font-semibold text-zinc-900 dark:text-zinc-100">
              {formatTime(elapsed)}
            </p>
          )}
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {status === "idle" && (mode === "continuous"
              ? "Tap to start continuous recording"
              : "Tap to start recording")}
            {status === "recording" && (mode === "continuous"
              ? "Listening... segments auto-captured on speech."
              : "Recording... Tap to stop.")}
            {status === "paused" && "Paused. Tap resume or stop."}
            {status === "uploading" && "Uploading audio..."}
            {status === "transcribing" && "Transcribing with Whisper..."}
            {status === "saving" && "Saving thought..."}
            {status === "done" && "Thought saved! Tap to record again."}
            {status === "error" && "Recording failed. Tap to try again."}
          </p>
        </div>

        {/* Pause / Cancel controls during single-shot recording */}
        {isRecording && mode === "single" && (
          <div className="flex gap-3">
            <button
              onClick={handlePause}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {status === "paused" ? "Resume" : "Pause"}
            </button>
            <button
              onClick={handleCancel}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Continuous mode: segment feed */}
        {mode === "continuous" && segments.length > 0 && (
          <div className="w-full space-y-2 text-left">
            <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Captured Segments ({segments.length})
            </h3>
            {segments.map((seg) => (
              <div
                key={seg.id}
                className={`rounded-lg border p-3 text-sm ${
                  seg.status === "transcribing"
                    ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950"
                    : seg.status === "error"
                      ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950"
                      : "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
                    {(seg.duration / 1000).toFixed(1)}s
                  </span>
                  {seg.status === "transcribing" && (
                    <span className="text-xs text-amber-600 dark:text-amber-400">
                      Transcribing...
                    </span>
                  )}
                </div>
                {seg.text && (
                  <p className="mt-1 text-zinc-800 dark:text-zinc-200">
                    {seg.text}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Processing spinner */}
        {isProcessing && (
          <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <svg
              className="h-4 w-4 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Processing...
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="w-full rounded-xl border border-red-200 bg-red-50 p-4 text-left dark:border-red-800 dark:bg-red-950">
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              {error}
            </p>
            {permissionDenied && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                Check your browser&apos;s address bar for microphone permission
                settings.
              </p>
            )}
          </div>
        )}

        {/* Transcript result (single mode) */}
        {transcript && mode === "single" && (
          <div className="w-full rounded-xl border border-zinc-200 bg-white p-6 text-left dark:border-zinc-700 dark:bg-zinc-900">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Transcript
              </p>
              <div className="flex items-center gap-2 text-xs text-zinc-400 dark:text-zinc-500">
                <span className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">
                  {transcript.language.toUpperCase()}
                </span>
                <span>
                  {Math.round(transcript.confidence * 100)}% confidence
                </span>
              </div>
            </div>
            <p className="text-zinc-800 dark:text-zinc-200">
              {transcript.text}
            </p>

            {transcript.segments.length > 1 && (
              <div className="mt-4 space-y-1 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                <p className="mb-2 text-xs font-medium text-zinc-400 dark:text-zinc-500">
                  Segments
                </p>
                {transcript.segments.map((seg, i) => (
                  <div key={i} className="flex gap-3 text-sm">
                    <span className="w-20 shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
                      {seg.start.toFixed(1)}s - {seg.end.toFixed(1)}s
                    </span>
                    <span className="text-zinc-700 dark:text-zinc-300">
                      {seg.text}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Done state: record again */}
        {(status === "done" || status === "error") && (
          <button
            onClick={handleReset}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
          >
            Record another thought
          </button>
        )}
      </div>
    </div>
  );
}
