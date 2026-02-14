"use client";

import { useState } from "react";
import Link from "next/link";
import { useThoughtsStore } from "@/lib/stores/thoughts";

interface ThoughtCardProps {
  id: string;
  type: string;
  priority: number;
  summary: string | null;
  cleanedText: string;
  status: string;
  categories: string[];
  deadline: string | null;
  createdAt: string;
  variant?: "default" | "compact";
  similarity?: number;
  onUpdate?: () => void;
}

const typeConfig: Record<string, { label: string; color: string }> = {
  task: { label: "Task", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  idea: { label: "Idea", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
  note: { label: "Note", color: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200" },
  reminder: { label: "Reminder", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  journal: { label: "Journal", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
};

const priorityDots = (priority: number) => {
  return Array.from({ length: 5 }, (_, i) => (
    <span
      key={i}
      className={`inline-block h-1.5 w-1.5 rounded-full ${
        i < priority ? "bg-indigo-500" : "bg-zinc-300 dark:bg-zinc-600"
      }`}
    />
  ));
};

export function ThoughtCard({
  id,
  type,
  priority,
  summary,
  cleanedText,
  status,
  categories,
  deadline,
  createdAt,
  variant = "default",
  similarity,
  onUpdate,
}: ThoughtCardProps) {
  const [showActions, setShowActions] = useState(false);
  const [showSnoozeMenu, setShowSnoozeMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editSummary, setEditSummary] = useState(summary || cleanedText);
  const [editType, setEditType] = useState(type);
  const [editPriority, setEditPriority] = useState(priority);
  const updateThought = useThoughtsStore((s) => s.updateThought);
  const removeThought = useThoughtsStore((s) => s.removeThought);

  const config = typeConfig[type] || typeConfig.note;
  const displayText = summary || cleanedText;
  const date = new Date(createdAt).toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  const patchThought = async (updates: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/thoughts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        updateThought(id, updates as Partial<ThoughtCardProps>);
        onUpdate?.();
      }
    } catch {
      /* ignore */
    }
  };

  const handleMarkDone = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    patchThought({ status: "done" });
  };

  const handleSnooze = (e: React.MouseEvent, duration: string) => {
    e.preventDefault();
    e.stopPropagation();
    const now = new Date();
    let snoozedUntil: Date;
    switch (duration) {
      case "1h":
        snoozedUntil = new Date(now.getTime() + 3600000);
        break;
      case "tomorrow":
        snoozedUntil = new Date(now);
        snoozedUntil.setDate(snoozedUntil.getDate() + 1);
        snoozedUntil.setHours(9, 0, 0, 0);
        break;
      case "next_week":
        snoozedUntil = new Date(now);
        snoozedUntil.setDate(snoozedUntil.getDate() + 7);
        snoozedUntil.setHours(9, 0, 0, 0);
        break;
      default:
        return;
    }
    patchThought({ status: "snoozed", snoozedUntil: snoozedUntil.toISOString() });
    setShowSnoozeMenu(false);
  };

  const handleArchive = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    patchThought({ status: "archived" });
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await fetch(`/api/thoughts/${id}`, { method: "DELETE" });
      removeThought(id);
      onUpdate?.();
    } catch {
      /* ignore */
    }
    setShowDeleteConfirm(false);
  };

  const handleSaveEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    patchThought({ summary: editSummary, type: editType, priority: editPriority });
    setIsEditing(false);
  };

  // Compact variant for search results and connections
  if (variant === "compact") {
    return (
      <Link href={`/thoughts/${id}`}>
        <div className="rounded-lg border border-zinc-200 bg-white p-3 transition-shadow hover:shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${config.color}`}>
              {config.label}
            </span>
            {similarity !== undefined && (
              <span className="text-xs text-zinc-400">{Math.round(similarity * 100)}%</span>
            )}
            <div className="ml-auto flex items-center gap-0.5">{priorityDots(priority)}</div>
          </div>
          <p className="mt-1.5 text-sm text-zinc-700 dark:text-zinc-300 line-clamp-2">
            {displayText}
          </p>
        </div>
      </Link>
    );
  }

  // Default variant with full actions
  return (
    <div
      className={`group relative rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900 ${status === "done" ? "opacity-60" : ""}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => {
        setShowActions(false);
        setShowSnoozeMenu(false);
        setShowDeleteConfirm(false);
      }}
    >
      {/* Action buttons (hover) */}
      {showActions && !isEditing && status !== "done" && (
        <div className="absolute -top-3 right-3 z-10 flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-1.5 py-1 shadow-md dark:border-zinc-600 dark:bg-zinc-800">
          <button
            onClick={handleMarkDone}
            title="Mark as done"
            className="rounded p-1 text-zinc-500 hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-950"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
            </svg>
          </button>
          <div className="relative">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowSnoozeMenu(!showSnoozeMenu);
              }}
              title="Snooze"
              className="rounded p-1 text-zinc-500 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-950"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z" clipRule="evenodd" />
              </svg>
            </button>
            {showSnoozeMenu && (
              <div className="absolute right-0 top-full mt-1 w-28 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-600 dark:bg-zinc-800">
                <button
                  onClick={(e) => handleSnooze(e, "1h")}
                  className="block w-full px-3 py-1.5 text-left text-xs hover:bg-zinc-50 dark:hover:bg-zinc-700"
                >
                  1 hour
                </button>
                <button
                  onClick={(e) => handleSnooze(e, "tomorrow")}
                  className="block w-full px-3 py-1.5 text-left text-xs hover:bg-zinc-50 dark:hover:bg-zinc-700"
                >
                  Tomorrow
                </button>
                <button
                  onClick={(e) => handleSnooze(e, "next_week")}
                  className="block w-full px-3 py-1.5 text-left text-xs hover:bg-zinc-50 dark:hover:bg-zinc-700"
                >
                  Next week
                </button>
              </div>
            )}
          </div>
          <button
            onClick={handleArchive}
            title="Archive"
            className="rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M2 3a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H2Z" />
              <path fillRule="evenodd" d="M2 7.5h16l-.811 7.71a2 2 0 0 1-1.99 1.79H4.802a2 2 0 0 1-1.99-1.79L2 7.5ZM7 11a1 1 0 0 1 1-1h4a1 1 0 1 1 0 2H8a1 1 0 0 1-1-1Z" clipRule="evenodd" />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsEditing(true);
            }}
            title="Edit"
            className="rounded p-1 text-zinc-500 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
              <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowDeleteConfirm(true);
            }}
            title="Delete"
            className="rounded p-1 text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 1 .7.798l-.5 5.5a.75.75 0 0 1-1.498-.136l.5-5.5a.75.75 0 0 1 .798-.662Zm2.84 0a.75.75 0 0 1 .798.662l.5 5.5a.75.75 0 1 1-1.498.136l-.5-5.5a.75.75 0 0 1 .7-.798Z" clipRule="evenodd" />
            </svg>
          </button>
          {showDeleteConfirm && (
            <div className="absolute right-0 top-full mt-1 rounded-lg border border-red-200 bg-white p-3 shadow-lg dark:border-red-800 dark:bg-zinc-800">
              <p className="mb-2 text-xs text-zinc-600 dark:text-zinc-300">Delete this thought?</p>
              <div className="flex gap-2">
                <button
                  onClick={handleDelete}
                  className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
                >
                  Delete
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowDeleteConfirm(false);
                  }}
                  className="rounded bg-zinc-200 px-2 py-1 text-xs dark:bg-zinc-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <Link href={`/thoughts/${id}`} className="block">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isEditing ? (
              <select
                value={editType}
                onChange={(e) => setEditType(e.target.value)}
                onClick={(e) => e.preventDefault()}
                className="rounded border border-zinc-300 px-1 py-0.5 text-xs dark:border-zinc-600 dark:bg-zinc-800"
              >
                {Object.entries(typeConfig).map(([key, { label }]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            ) : (
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${config.color}`}>
                {config.label}
              </span>
            )}
            {status === "done" && (
              <span className="text-xs text-green-600 dark:text-green-400">Done</span>
            )}
            {status === "snoozed" && (
              <span className="text-xs text-amber-600 dark:text-amber-400">Snoozed</span>
            )}
          </div>

          {isEditing ? (
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 5 }, (_, i) => (
                <button
                  key={i}
                  onClick={(e) => {
                    e.preventDefault();
                    setEditPriority(i + 1);
                  }}
                  className={`h-2 w-2 rounded-full ${
                    i < editPriority ? "bg-indigo-500" : "bg-zinc-300 dark:bg-zinc-600"
                  }`}
                />
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-1">{priorityDots(priority)}</div>
          )}
        </div>

        {isEditing ? (
          <div onClick={(e) => e.preventDefault()}>
            <textarea
              value={editSummary}
              onChange={(e) => setEditSummary(e.target.value)}
              className="w-full rounded border border-zinc-300 p-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              rows={3}
            />
            <div className="mt-2 flex gap-2">
              <button
                onClick={handleSaveEdit}
                className="rounded bg-indigo-600 px-3 py-1 text-xs text-white hover:bg-indigo-700"
              >
                Save
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  setIsEditing(false);
                  setEditSummary(summary || cleanedText);
                  setEditType(type);
                  setEditPriority(priority);
                }}
                className="rounded bg-zinc-200 px-3 py-1 text-xs dark:bg-zinc-600"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p
            className={`text-sm text-zinc-800 dark:text-zinc-200 ${
              status === "done" ? "line-through" : ""
            }`}
          >
            {displayText}
          </p>
        )}

        <div className="mt-3 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
          <div className="flex gap-1.5">
            {categories.map((cat) => (
              <span key={cat} className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">
                {cat}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {deadline && (
              <span className="text-red-500">
                {new Date(deadline).toLocaleDateString("cs-CZ", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            )}
            <span>{date}</span>
          </div>
        </div>
      </Link>
    </div>
  );
}
