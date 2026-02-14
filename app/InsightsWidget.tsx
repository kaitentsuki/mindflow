"use client";

import { useEffect, useState } from "react";

export function InsightsWidget({ totalThoughts }: { totalThoughts: number }) {
  const [insights, setInsights] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (totalThoughts < 10) return;
    setLoading(true);
    fetch("/api/insights")
      .then((r) => r.json())
      .then((data) => {
        setInsights(data.insights || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [totalThoughts]);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="mb-3 flex items-center gap-2">
        <svg
          className="h-5 w-5 text-emerald-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Insights
        </h2>
      </div>

      {totalThoughts < 10 ? (
        <p className="text-sm text-zinc-400 dark:text-zinc-500">
          Record at least 10 thoughts to unlock AI insights.
        </p>
      ) : loading ? (
        <p className="text-sm text-zinc-400 dark:text-zinc-500">
          Generating insights...
        </p>
      ) : insights.length > 0 ? (
        <ul className="space-y-2">
          {insights.map((insight, i) => (
            <li
              key={i}
              className="flex gap-2 text-sm text-zinc-600 dark:text-zinc-400"
            >
              <span className="mt-0.5 flex-shrink-0 text-emerald-500">
                &bull;
              </span>
              {insight}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-400 dark:text-zinc-500">
          No insights available yet.
        </p>
      )}
    </div>
  );
}
