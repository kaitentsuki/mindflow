"use client";

import { useRef, useEffect } from "react";

interface WaveformVisualizerProps {
  analyser: AnalyserNode | null;
  isActive: boolean;
}

export function WaveformVisualizer({ analyser, isActive }: WaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        canvas.width = width * window.devicePixelRatio;
        canvas.height = 80 * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      }
    });
    resizeObserver.observe(canvas);

    const draw = () => {
      const w = canvas.width / window.devicePixelRatio;
      const h = canvas.height / window.devicePixelRatio;

      ctx.clearRect(0, 0, w, h);

      if (!analyser || !isActive) {
        // Draw idle bars
        const barCount = 32;
        const gap = 2;
        const barWidth = (w - gap * (barCount - 1)) / barCount;
        for (let i = 0; i < barCount; i++) {
          const barH = 4;
          const x = i * (barWidth + gap);
          const y = (h - barH) / 2;
          ctx.fillStyle = "rgb(161, 161, 170)"; // zinc-400
          ctx.fillRect(x, y, barWidth, barH);
        }
        animFrameRef.current = requestAnimationFrame(draw);
        return;
      }

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteFrequencyData(dataArray);

      const barCount = Math.min(bufferLength, 64);
      const gap = 2;
      const barWidth = (w - gap * (barCount - 1)) / barCount;

      for (let i = 0; i < barCount; i++) {
        const dataIndex = Math.floor((i / barCount) * bufferLength);
        const value = dataArray[dataIndex];
        const barH = Math.max(2, (value / 255) * h * 0.9);
        const x = i * (barWidth + gap);
        const y = (h - barH) / 2;

        ctx.fillStyle = "rgb(99, 102, 241)"; // indigo-500
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barH, 1);
        ctx.fill();
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    animFrameRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      resizeObserver.disconnect();
    };
  }, [analyser, isActive]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full"
      style={{ height: 80 }}
    />
  );
}
