"use client";

interface LibraryFiltersProps {
  type: string;
  priority: string;
  category: string;
  status: string;
  dateFrom: string;
  dateTo: string;
  onChange: (filters: Record<string, string>) => void;
}

const types = [
  { value: "", label: "All types" },
  { value: "task", label: "Task" },
  { value: "idea", label: "Idea" },
  { value: "note", label: "Note" },
  { value: "reminder", label: "Reminder" },
  { value: "journal", label: "Journal" },
];

const statuses = [
  { value: "active", label: "Active" },
  { value: "", label: "All" },
  { value: "done", label: "Done" },
  { value: "snoozed", label: "Snoozed" },
  { value: "archived", label: "Archived" },
];

export function LibraryFilters({ type, priority, category, status, dateFrom, dateTo, onChange }: LibraryFiltersProps) {
  const update = (key: string, value: string) => {
    onChange({ type, priority, category, status, dateFrom, dateTo, [key]: value });
  };

  return (
    <div className="space-y-3">
      {/* Type pills */}
      <div className="flex flex-wrap gap-1.5">
        {types.map(t => (
          <button
            key={t.value}
            onClick={() => update("type", t.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              type === t.value
                ? "bg-indigo-600 text-white"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Second row: status, priority, dates */}
      <div className="flex items-center gap-3 overflow-x-auto">
        {/* Status toggle */}
        <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-700">
          {statuses.map(s => (
            <button
              key={s.value}
              onClick={() => update("status", s.value)}
              className={`px-2.5 py-1 text-xs transition-colors first:rounded-l-lg last:rounded-r-lg ${
                status === s.value
                  ? "bg-indigo-600 text-white"
                  : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Priority dropdown */}
        <select
          value={priority}
          onChange={(e) => update("priority", e.target.value)}
          className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
        >
          <option value="">Any priority</option>
          <option value="5">Priority 5 (highest)</option>
          <option value="4">Priority 4+</option>
          <option value="3">Priority 3+</option>
        </select>

        {/* Date range */}
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => update("dateFrom", e.target.value)}
            className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
          />
          <span className="text-xs text-zinc-400">{"\u2192"}</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => update("dateTo", e.target.value)}
            className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
          />
        </div>

        {/* Category input */}
        <input
          type="text"
          value={category}
          onChange={(e) => update("category", e.target.value)}
          placeholder="Category..."
          className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
        />
      </div>
    </div>
  );
}
