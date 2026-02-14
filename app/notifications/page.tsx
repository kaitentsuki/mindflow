"use client";

import { useEffect, useState } from "react";
import { NotificationCard } from "@/components/NotificationCard";
import { useNotificationStore } from "@/lib/stores/notifications";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  url: string | null;
  readAt: string | null;
  dismissedAt: string | null;
  createdAt: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const { markAllRead, fetchCount } = useNotificationStore();

  const loadNotifications = async (offset = 0) => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "20", offset: String(offset) });
    if (filter === "unread") params.set("unread", "true");
    if (filter !== "all" && filter !== "unread") params.set("type", filter);

    const res = await fetch(`/api/notifications?${params}`);
    if (res.ok) {
      const data = await res.json();
      setNotifications(offset === 0 ? data.notifications : [...notifications, ...data.notifications]);
      setTotal(data.total);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const handleMarkAllRead = async () => {
    await markAllRead();
    await fetchCount();
    loadNotifications();
  };

  const filters = [
    { value: "all", label: "All" },
    { value: "unread", label: "Unread" },
    { value: "deadline_24h", label: "Deadlines" },
    { value: "morning_briefing", label: "Briefings" },
    { value: "weekly_digest", label: "Digests" },
    { value: "connection", label: "Connections" },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            Notifications
          </h1>
          <p className="mt-1 text-zinc-500 dark:text-zinc-400">
            {total} notification{total !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={handleMarkAllRead}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
        >
          Mark all read
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              filter === f.value
                ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && notifications.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          Loading...
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          No notifications
        </div>
      ) : (
        <div className="space-y-1 rounded-xl border border-zinc-200 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-900">
          {notifications.map((n) => (
            <NotificationCard
              key={n.id}
              id={n.id}
              type={n.type}
              title={n.title}
              body={n.body}
              url={n.url}
              readAt={n.readAt}
              createdAt={n.createdAt}
            />
          ))}
          {notifications.length < total && (
            <button
              onClick={() => loadNotifications(notifications.length)}
              className="w-full rounded-lg py-2 text-center text-sm text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/30"
            >
              Load more
            </button>
          )}
        </div>
      )}
    </div>
  );
}
