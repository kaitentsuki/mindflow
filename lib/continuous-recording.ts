/**
 * ContinuousRecording — VAD-based segmented recording.
 * Detects speech via simple energy threshold, records segments,
 * and calls onSegment when a silence gap (>1.5s) is detected.
 */

export type ContinuousRecordingState = "idle" | "running" | "stopping";

export class ContinuousRecording {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private segmentStartTime = 0;
  private rafId = 0;
  private silenceStart = 0;
  private isSpeaking = false;
  private _state: ContinuousRecordingState = "idle";

  private readonly onSegment: (blob: Blob, duration: number) => void;
  private readonly language: string;
  private readonly silenceThreshold: number;
  private readonly silenceGapMs: number;

  constructor(
    onSegment: (blob: Blob, duration: number) => void,
    language = "cs",
    options?: { silenceThreshold?: number; silenceGapMs?: number }
  ) {
    this.onSegment = onSegment;
    this.language = language;
    this.silenceThreshold = options?.silenceThreshold ?? 15;
    this.silenceGapMs = options?.silenceGapMs ?? 1500;
  }

  get state(): ContinuousRecordingState {
    return this._state;
  }

  get isRunning(): boolean {
    return this._state === "running";
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  private getMimeType(): string {
    if (typeof MediaRecorder === "undefined") return "audio/webm";
    if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus"))
      return "audio/webm;codecs=opus";
    if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
    if (MediaRecorder.isTypeSupported("audio/mp4")) return "audio/mp4";
    return "audio/webm";
  }

  async start(): Promise<void> {
    if (this._state === "running") return;

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: true,
        channelCount: 1,
      },
    });

    this.audioContext = new AudioContext();
    const source = this.audioContext.createMediaStreamSource(this.stream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    source.connect(this.analyser);

    this._state = "running";
    this.isSpeaking = false;
    this.silenceStart = 0;

    this.monitor();
  }

  stop(): void {
    this._state = "stopping";
    cancelAnimationFrame(this.rafId);

    // Finalize any in-progress segment
    if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
      this.mediaRecorder.stop();
    } else {
      this.cleanup();
    }
  }

  private monitor = () => {
    if (this._state !== "running") return;

    const level = this.getEnergyLevel();
    const now = Date.now();

    if (level > this.silenceThreshold) {
      // Speech detected
      if (!this.isSpeaking) {
        this.isSpeaking = true;
        this.startSegmentRecorder();
      }
      this.silenceStart = 0;
    } else if (this.isSpeaking) {
      // Silence while speaking
      if (this.silenceStart === 0) {
        this.silenceStart = now;
      } else if (now - this.silenceStart > this.silenceGapMs) {
        // Silence gap exceeded — end segment
        this.endSegment();
      }
    }

    this.rafId = requestAnimationFrame(this.monitor);
  };

  private getEnergyLevel(): number {
    if (!this.analyser) return 0;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    const sum = data.reduce((a, b) => a + b, 0);
    return sum / data.length;
  }

  private startSegmentRecorder(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === "recording") return;
    if (!this.stream) return;

    this.chunks = [];
    const mimeType = this.getMimeType();
    this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };

    this.mediaRecorder.onstop = () => {
      const mimeType = this.mediaRecorder?.mimeType || "audio/webm";
      const blob = new Blob(this.chunks, { type: mimeType });
      const duration = Date.now() - this.segmentStartTime;
      this.chunks = [];

      if (blob.size > 0 && duration > 500) {
        this.onSegment(blob, duration);
      }

      if (this._state === "stopping") {
        this.cleanup();
      }
    };

    // No timeslice — single valid file on stop
    this.mediaRecorder.start();
    this.segmentStartTime = Date.now();
  }

  private endSegment(): void {
    this.isSpeaking = false;
    this.silenceStart = 0;
    if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
      this.mediaRecorder.stop();
    }
  }

  private cleanup(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.analyser = null;
    this.mediaRecorder = null;
    this.chunks = [];
    this._state = "idle";
  }
}
