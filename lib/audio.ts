/**
 * Browser audio capture service using Web Audio API + MediaRecorder.
 * Records audio as webm chunks and returns a Blob for upload.
 */

export type AudioState = "idle" | "recording" | "paused" | "error";

export interface AudioCaptureResult {
  blob: Blob;
  durationMs: number;
  mimeType: string;
}

export class AudioCapture {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private startTime = 0;
  private pausedDuration = 0;
  private pauseStart = 0;
  private _state: AudioState = "idle";
  private analyser: AnalyserNode | null = null;
  private audioContext: AudioContext | null = null;

  get state(): AudioState {
    return this._state;
  }

  /**
   * Get the preferred MIME type for recording.
   * Prefers webm (smaller) with wav as fallback.
   */
  private getMimeType(): string {
    if (typeof MediaRecorder === "undefined") return "audio/webm";
    if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
      return "audio/webm;codecs=opus";
    }
    if (MediaRecorder.isTypeSupported("audio/webm")) {
      return "audio/webm";
    }
    if (MediaRecorder.isTypeSupported("audio/mp4")) {
      return "audio/mp4";
    }
    return "audio/webm";
  }

  /**
   * Request microphone permission and start recording.
   */
  async start(): Promise<void> {
    if (this._state === "recording") return;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // Browser audio processing degrades STT quality — STT models handle noise better
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: true,
          channelCount: 1,
        },
      });

      // Set up analyser for waveform visualization
      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaStreamSource(this.stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      const mimeType = this.getMimeType();
      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });
      this.chunks = [];
      this.pausedDuration = 0;

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.chunks.push(event.data);
        }
      };

      // No timeslice — single valid file on stop (avoids corrupted WebM from chunk concat)
      this.mediaRecorder.start();
      this.startTime = Date.now();
      this._state = "recording";
    } catch (error) {
      this._state = "error";
      throw error;
    }
  }

  /**
   * Pause recording.
   */
  pause(): void {
    if (this._state !== "recording" || !this.mediaRecorder) return;
    this.mediaRecorder.pause();
    this.pauseStart = Date.now();
    this._state = "paused";
  }

  /**
   * Resume recording after pause.
   */
  resume(): void {
    if (this._state !== "paused" || !this.mediaRecorder) return;
    this.mediaRecorder.resume();
    this.pausedDuration += Date.now() - this.pauseStart;
    this._state = "recording";
  }

  /**
   * Stop recording and return the captured audio blob.
   */
  stop(): Promise<AudioCaptureResult> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || this._state === "idle") {
        reject(new Error("Not recording"));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder?.mimeType || "audio/webm";
        const blob = new Blob(this.chunks, { type: mimeType });
        const durationMs =
          Date.now() - this.startTime - this.pausedDuration;

        this.cleanup();
        resolve({ blob, durationMs, mimeType });
      };

      this.mediaRecorder.onerror = () => {
        this.cleanup();
        reject(new Error("Recording failed"));
      };

      this.mediaRecorder.stop();
    });
  }

  /**
   * Get the AnalyserNode for external visualization (e.g. WaveformVisualizer).
   */
  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  /**
   * Get frequency data array from the analyser.
   */
  getFrequencyData(): Uint8Array {
    if (!this.analyser) return new Uint8Array(0);
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }

  /**
   * Get current audio levels for visualization (0-255).
   */
  getAudioLevel(): number {
    if (!this.analyser) return 0;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    // Return average level
    const sum = data.reduce((a, b) => a + b, 0);
    return sum / data.length;
  }

  /**
   * Get elapsed recording duration in ms (excluding paused time).
   */
  getElapsedMs(): number {
    if (this._state === "idle") return 0;
    const now = this._state === "paused" ? this.pauseStart : Date.now();
    return now - this.startTime - this.pausedDuration;
  }

  /**
   * Clean up all resources.
   */
  private cleanup(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
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

  /**
   * Cancel recording and discard data.
   */
  cancel(): void {
    if (this.mediaRecorder && this._state !== "idle") {
      this.mediaRecorder.onstop = null;
      try {
        this.mediaRecorder.stop();
      } catch {
        // ignore if already stopped
      }
    }
    this.cleanup();
  }
}
