"use client";

import { useState } from "react";
import Link from "next/link";
import { ThoughtCard } from "./ThoughtCard";
import { AudioPlayer } from "./AudioPlayer";

interface ThoughtData {
  id: string;
  type: string;
  priority: number;
  summary: string | null;
  cleanedText: string;
  rawTranscript: string;
  status: string;
  categories: string[];
  deadline: string | null;
  createdAt: string;
  updatedAt: string;
  sentiment: number | null;
  entities: { people?: string[]; places?: string[]; projects?: string[] };
  actionItems: string[];
  language: string;
  source: string;
  snoozedUntil: string | null;
  completedAt: string | null;
  audioUrl: string | null;
  audioMime: string | null;
  calendarEventId: string | null;
  todoistTaskId: string | null;
  notionPageId: string | null;
}

interface Connection {
  id: string;
  type: string;
  priority: number;
  summary: string | null;
  cleanedText: string;
  status: string;
  categories: string[];
  deadline: string | null;
  createdAt: string;
  similarity: number;
}

interface ThoughtDetailProps {
  thought: ThoughtData;
  connections: Connection[];
}

const typeConfig: Record<string, { label: string; color: string }> = {
  task: { label: "Task", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  idea: { label: "Idea", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
  note: { label: "Note", color: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200" },
  reminder: {
    label: "Reminder",
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  },
  journal: {
    label: "Journal",
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  },
};

export function ThoughtDetail({ thought, connections }: ThoughtDetailProps) {
  const [currentThought, setCurrentThought] = useState(thought);
  const [integrationLoading, setIntegrationLoading] = useState<string | null>(null);
  const config = typeConfig[currentThought.type] || typeConfig.note;

  const handleIntegration = async (service: string) => {
    setIntegrationLoading(service);
    try {
      const res = await fetch(`/api/integrations/${service}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thoughtId: thought.id }),
      });
      if (res.ok) {
        const data = await res.json();
        if (service === "google-calendar") {
          setCurrentThought((prev) => ({ ...prev, calendarEventId: data.eventId }));
        } else if (service === "todoist") {
          setCurrentThought((prev) => ({ ...prev, todoistTaskId: data.todoistTaskId }));
        } else if (service === "notion") {
          setCurrentThought((prev) => ({ ...prev, notionPageId: data.notionPageId }));
        }
      } else {
        const err = await res.json();
        alert(err.error || `Failed to export to ${service}`);
      }
    } catch {
      alert(`Failed to export to ${service}`);
    } finally {
      setIntegrationLoading(null);
    }
  };

  const handleAction = async (updates: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/thoughts/${thought.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const updated = await res.json();
        setCurrentThought((prev) => ({ ...prev, ...updates, status: updated.status }));
      }
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      {/* Breadcrumb */}
      <div className="mb-4">
        <Link
          href="/library"
          className="text-sm text-indigo-600 hover:underline dark:text-indigo-400"
        >
          &larr; Back to Library
        </Link>
      </div>

      {/* Main card */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-sm font-medium ${config.color}`}>
              {config.label}
            </span>
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }, (_, i) => (
                <span
                  key={i}
                  className={`h-2 w-2 rounded-full ${
                    i < currentThought.priority
                      ? "bg-indigo-500"
                      : "bg-zinc-300 dark:bg-zinc-600"
                  }`}
                />
              ))}
            </div>
            {currentThought.status === "done" && (
              <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-300">
                Done
              </span>
            )}
            {currentThought.status === "snoozed" && (
              <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                Snoozed
              </span>
            )}
            {currentThought.status === "archived" && (
              <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                Archived
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {currentThought.status === "active" && (
              <>
                <button
                  onClick={() => handleAction({ status: "done" })}
                  className="rounded-lg bg-green-50 px-3 py-1.5 text-sm text-green-700 hover:bg-green-100 dark:bg-green-950 dark:text-green-300"
                >
                  Mark Done
                </button>
                <button
                  onClick={() => handleAction({ status: "archived" })}
                  className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  Archive
                </button>
              </>
            )}
            {currentThought.status === "done" && (
              <button
                onClick={() => handleAction({ status: "active" })}
                className="rounded-lg bg-indigo-50 px-3 py-1.5 text-sm text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300"
              >
                Reopen
              </button>
            )}
          </div>
        </div>

        {/* Integration buttons */}
        <div className="mb-4 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          {currentThought.deadline && (
            currentThought.calendarEventId ? (
              <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700 dark:bg-green-950 dark:text-green-300">
                Calendar synced
              </span>
            ) : (
              <button
                onClick={() => handleIntegration("google-calendar")}
                disabled={integrationLoading === "google-calendar"}
                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                {integrationLoading === "google-calendar" ? "Adding..." : "Add to Calendar"}
              </button>
            )
          )}
          {currentThought.type === "task" && (
            currentThought.todoistTaskId ? (
              <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700 dark:bg-green-950 dark:text-green-300">
                Todoist synced
              </span>
            ) : (
              <button
                onClick={() => handleIntegration("todoist")}
                disabled={integrationLoading === "todoist"}
                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                {integrationLoading === "todoist" ? "Exporting..." : "Export to Todoist"}
              </button>
            )
          )}
          {currentThought.notionPageId ? (
            <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700 dark:bg-green-950 dark:text-green-300">
              Notion synced
            </span>
          ) : (
            <button
              onClick={() => handleIntegration("notion")}
              disabled={integrationLoading === "notion"}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              {integrationLoading === "notion" ? "Exporting..." : "Export to Notion"}
            </button>
          )}
        </div>

        {/* Summary */}
        <h2 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          {currentThought.summary || currentThought.cleanedText}
        </h2>

        {/* Audio player */}
        {currentThought.audioUrl && (
          <div className="mb-4">
            <h3 className="mb-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Audio recording
            </h3>
            <AudioPlayer
              src={currentThought.audioUrl}
              mimeType={currentThought.audioMime || undefined}
            />
          </div>
        )}

        {/* Full transcript */}
        {currentThought.rawTranscript !== currentThought.cleanedText && (
          <div className="mb-4">
            <h3 className="mb-1 text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Original transcript
            </h3>
            <p className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {currentThought.rawTranscript}
            </p>
          </div>
        )}

        {/* Metadata grid */}
        <div className="mt-4 grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
          {/* Categories */}
          {currentThought.categories.length > 0 && (
            <div>
              <h4 className="mb-1 font-medium text-zinc-500 dark:text-zinc-400">Categories</h4>
              <div className="flex flex-wrap gap-1.5">
                {currentThought.categories.map((cat) => (
                  <span
                    key={cat}
                    className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs dark:bg-zinc-800"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Entities */}
          {(currentThought.entities?.people?.length ||
            currentThought.entities?.places?.length ||
            currentThought.entities?.projects?.length) && (
            <div>
              <h4 className="mb-1 font-medium text-zinc-500 dark:text-zinc-400">Entities</h4>
              <div className="space-y-1">
                {currentThought.entities.people?.map((p) => (
                  <span
                    key={p}
                    className="mr-1.5 inline-block rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                  >
                    {p}
                  </span>
                ))}
                {currentThought.entities.places?.map((p) => (
                  <span
                    key={p}
                    className="mr-1.5 inline-block rounded bg-green-50 px-2 py-0.5 text-xs text-green-700 dark:bg-green-950 dark:text-green-300"
                  >
                    {p}
                  </span>
                ))}
                {currentThought.entities.projects?.map((p) => (
                  <span
                    key={p}
                    className="mr-1.5 inline-block rounded bg-purple-50 px-2 py-0.5 text-xs text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Action items */}
          {currentThought.actionItems.length > 0 && (
            <div className="col-span-2">
              <h4 className="mb-1 font-medium text-zinc-500 dark:text-zinc-400">Action items</h4>
              <ul className="space-y-1">
                {currentThought.actionItems.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-zinc-700 dark:text-zinc-300"
                  >
                    <span className="mt-0.5 text-xs">&bull;</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Dates */}
          <div>
            <h4 className="mb-1 font-medium text-zinc-500 dark:text-zinc-400">Created</h4>
            <p className="text-zinc-700 dark:text-zinc-300">
              {new Date(currentThought.createdAt).toLocaleString("cs-CZ")}
            </p>
          </div>

          {currentThought.deadline && (
            <div>
              <h4 className="mb-1 font-medium text-zinc-500 dark:text-zinc-400">Deadline</h4>
              <p className="text-red-600 dark:text-red-400">
                {new Date(currentThought.deadline).toLocaleString("cs-CZ")}
              </p>
            </div>
          )}

          {currentThought.sentiment !== null && (
            <div>
              <h4 className="mb-1 font-medium text-zinc-500 dark:text-zinc-400">Sentiment</h4>
              <p className="text-zinc-700 dark:text-zinc-300">
                {currentThought.sentiment > 0.3
                  ? "Positive"
                  : currentThought.sentiment < -0.3
                    ? "Negative"
                    : "Neutral"}{" "}
                ({currentThought.sentiment.toFixed(2)})
              </p>
            </div>
          )}

          <div>
            <h4 className="mb-1 font-medium text-zinc-500 dark:text-zinc-400">Source</h4>
            <p className="text-zinc-700 dark:text-zinc-300 capitalize">
              {currentThought.source} &bull; {currentThought.language.toUpperCase()}
            </p>
          </div>
        </div>
      </div>

      {/* Connected thoughts */}
      {connections.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Connected Thoughts ({connections.length})
          </h3>
          <div className="space-y-2">
            {connections.map((conn) => (
              <ThoughtCard
                key={conn.id}
                id={conn.id}
                type={conn.type}
                priority={conn.priority}
                summary={conn.summary}
                cleanedText={conn.cleanedText}
                status={conn.status}
                categories={conn.categories}
                deadline={conn.deadline}
                createdAt={conn.createdAt}
                variant="compact"
                similarity={conn.similarity}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
