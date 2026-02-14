"use client";

import { useRouter } from "next/navigation";
import { useNotificationStore } from "@/lib/stores/notifications";

const typeIcons: Record<string, string> = {
  deadline_24h: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  deadline_1h: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  forgotten_task: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  morning_briefing: "M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707",
  weekly_digest: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  connection: "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1",
  insight: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
};

const typeColors: Record<string, string> = {
  deadline_1h: "text-red-500",
  deadline_24h: "text-amber-500",
  forgotten_task: "text-orange-500",
  morning_briefing: "text-indigo-500",
  weekly_digest: "text-purple-500",
  connection: "text-blue-500",
  insight: "text-emerald-500",
};

interface NotificationCardProps {
  id: string;
  type: string;
  title: string;
  body: string | null;
  url: string | null;
  readAt: string | null;
  createdAt: string;
  compact?: boolean;
}

export function NotificationCard({
  id,
  type,
  title,
  body,
  url,
  readAt,
  createdAt,
  compact = false,
}: NotificationCardProps) {
  const router = useRouter();
  const { markAsRead, dismiss } = useNotificationStore();

  const icon = typeIcons[type] || typeIcons.insight;
  const color = typeColors[type] || "text-zinc-500";
  const isUnread = !readAt;

  const timeAgo = formatTimeAgo(new Date(createdAt));

  const handleClick = () => {
    if (isUnread) markAsRead(id);
    if (url) router.push(url);
  };

  return (
    <div
      onClick={handleClick}
      className={`group flex gap-3 rounded-lg p-3 transition-colors cursor-pointer ${
        isUnread
          ? "bg-indigo-50/50 dark:bg-indigo-950/20"
          : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
      }`}
    >
      <div className={`mt-0.5 flex-shrink-0 ${color}`}>
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm ${isUnread ? "font-semibold" : "font-medium"} text-zinc-900 dark:text-zinc-100`}>
            {title}
          </p>
          {!compact && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                dismiss(id);
              }}
              className="flex-shrink-0 rounded p-1 text-zinc-400 opacity-0 transition-opacity hover:text-zinc-600 group-hover:opacity-100 dark:hover:text-zinc-300"
              title="Dismiss"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        {body && !compact && (
          <p className="mt-0.5 line-clamp-2 text-sm text-zinc-500 dark:text-zinc-400 whitespace-pre-line">
            {body}
          </p>
        )}
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">{timeAgo}</p>
      </div>
      {isUnread && (
        <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-indigo-500" />
      )}
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}
