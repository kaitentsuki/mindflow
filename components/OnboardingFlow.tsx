"use client";

import { useState, useEffect } from "react";

const steps = [
  {
    icon: "M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z",
    title: "Record your thoughts",
    description: "Tap the microphone and speak freely. MindFlow transcribes and categorizes everything automatically.",
  },
  {
    icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10",
    title: "Browse your library",
    description: "All your thoughts are searchable and organized by type, priority, and categories. Find anything instantly.",
  },
  {
    icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
    title: "Chat with AI",
    description: "Ask questions about your captured thoughts. MindFlow uses RAG to find relevant context and give smart answers.",
  },
];

export function OnboardingFlow() {
  const [step, setStep] = useState(0);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (!data.onboarding_completed) {
          setShow(true);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const complete = async () => {
    setShow(false);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onboarding_completed: true }),
    });
  };

  if (loading || !show) return null;

  const current = steps[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative w-full max-w-md rounded-xl border border-zinc-200 bg-white p-8 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
        {/* Step indicator */}
        <div className="mb-6 flex items-center justify-center gap-2">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 w-8 rounded-full transition-colors ${
                i <= step ? "bg-indigo-600" : "bg-zinc-200 dark:bg-zinc-700"
              }`}
            />
          ))}
        </div>

        {/* Icon */}
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-950">
          <svg
            className="h-8 w-8 text-indigo-600 dark:text-indigo-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d={current.icon} />
          </svg>
        </div>

        {/* Content */}
        <h2 className="mb-2 text-center text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          {current.title}
        </h2>
        <p className="mb-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
          {current.description}
        </p>

        {/* Buttons */}
        <div className="flex items-center justify-between">
          <button
            onClick={complete}
            className="text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            Skip
          </button>
          {step < steps.length - 1 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Next
            </button>
          ) : (
            <button
              onClick={complete}
              className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Get started
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
