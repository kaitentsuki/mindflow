"use client";

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
  type,
  priority,
  summary,
  cleanedText,
  status,
  categories,
  deadline,
  createdAt,
}: ThoughtCardProps) {
  const config = typeConfig[type] || typeConfig.note;
  const displayText = summary || cleanedText;
  const date = new Date(createdAt).toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900 ${status === "done" ? "opacity-60" : ""}`}>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${config.color}`}>
            {config.label}
          </span>
          {status === "done" && (
            <span className="text-xs text-green-600 dark:text-green-400">Done</span>
          )}
        </div>
        <div className="flex items-center gap-1">{priorityDots(priority)}</div>
      </div>

      <p className={`text-sm text-zinc-800 dark:text-zinc-200 ${status === "done" ? "line-through" : ""}`}>
        {displayText}
      </p>

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
              {new Date(deadline).toLocaleDateString("cs-CZ", { day: "numeric", month: "short" })}
            </span>
          )}
          <span>{date}</span>
        </div>
      </div>
    </div>
  );
}
