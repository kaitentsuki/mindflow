"use client";

interface Source {
  thoughtId: string;
  summary: string;
}

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  isStreaming?: boolean;
}

export function ChatMessage({ role, content, sources, isStreaming }: ChatMessageProps) {
  return (
    <div className={`flex ${role === "user" ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%]`}>
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
            role === "user"
              ? "bg-indigo-600 text-white"
              : "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
          }`}
        >
          {content}
          {isStreaming && (
            <span className="ml-0.5 inline-block h-4 w-1 animate-pulse bg-current" />
          )}
        </div>

        {/* Source citations */}
        {sources && sources.length > 0 && role === "assistant" && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {sources.map((source, i) => (
              <a
                key={source.thoughtId}
                href={`/thoughts/${source.thoughtId}`}
                className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300 dark:hover:bg-indigo-900"
              >
                <span className="font-medium">[{i + 1}]</span>
                <span className="max-w-[200px] truncate">{source.summary}</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
