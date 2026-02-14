"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { usePushSubscription } from "@/lib/hooks/usePushSubscription";
import { ImportDialog } from "@/components/ImportDialog";

interface NotificationPrefs {
  enabled: boolean;
  deadline_reminders: boolean;
  forgotten_tasks: boolean;
  morning_briefing: boolean;
  weekly_digest: boolean;
  connection_suggestions: boolean;
  insights: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
}

interface Settings {
  timezone: string;
  language: string;
  notifications: NotificationPrefs;
  todoist_api_token?: string;
  notion_api_token?: string;
  notion_database_id?: string;
  google_calendar_auto_sync?: boolean;
}

const defaultSettings: Settings = {
  timezone: "Europe/Prague",
  language: "cs",
  notifications: {
    enabled: true,
    deadline_reminders: true,
    forgotten_tasks: true,
    morning_briefing: true,
    weekly_digest: true,
    connection_suggestions: true,
    insights: false,
    quiet_hours_start: "22:00",
    quiet_hours_end: "08:00",
  },
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { isSubscribed, isSupported, loading: pushLoading, subscribe, unsubscribe } =
    usePushSubscription();
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [gcalConnected, setGcalConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setSettings({ ...defaultSettings, ...data, notifications: { ...defaultSettings.notifications, ...data.notifications } });
        setLoading(false);
      })
      .catch(() => setLoading(false));

    fetch("/api/integrations/google-calendar")
      .then((r) => r.json())
      .then((data) => setGcalConnected(data.connected))
      .catch(() => {});
  }, []);

  const save = async (updates: Partial<Settings>) => {
    setSaving(true);
    const merged = { ...settings, ...updates };
    if (updates.notifications) {
      merged.notifications = { ...settings.notifications, ...updates.notifications };
    }
    setSettings(merged);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    setSaving(false);
  };

  const toggleNotifPref = (key: keyof NotificationPrefs) => {
    const newValue = !settings.notifications[key];
    save({ notifications: { ...settings.notifications, [key]: newValue } });
  };

  const updateQuietHours = (field: "quiet_hours_start" | "quiet_hours_end", value: string) => {
    save({ notifications: { ...settings.notifications, [field]: value } });
  };

  const handleExport = async (format: string) => {
    setExporting(format);
    try {
      const res = await fetch(`/api/export?format=${format}`);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.headers.get("Content-Disposition")?.split("filename=")[1]?.replace(/"/g, "") || `export.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(null);
    }
  };

  const handleCalendarSync = async () => {
    setSyncing(true);
    try {
      await fetch("/api/integrations/google-calendar/sync", { method: "POST" });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-8 text-3xl font-bold text-zinc-900 dark:text-zinc-100">Settings</h1>
        <p className="text-zinc-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-2 text-3xl font-bold text-zinc-900 dark:text-zinc-100">
        Settings
      </h1>
      <p className="mb-8 text-zinc-500 dark:text-zinc-400">
        Configure your MindFlow preferences.
        {saving && <span className="ml-2 text-indigo-500">Saving...</span>}
      </p>

      <div className="space-y-6">
        {/* Theme */}
        <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Theme
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Choose your preferred appearance.
          </p>
          {mounted && (
            <div className="mt-4 flex gap-3">
              {(["light", "dark", "system"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                    theme === t
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                      : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  }`}
                >
                  {t === "light" && (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  )}
                  {t === "dark" && (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  )}
                  {t === "system" && (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  )}
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Profile */}
        <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Profile
          </h2>
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Timezone
              </label>
              <select
                value={settings.timezone}
                onChange={(e) => save({ timezone: e.target.value })}
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              >
                <option value="Europe/Prague">Europe/Prague (CET)</option>
                <option value="Europe/London">Europe/London (GMT)</option>
                <option value="America/New_York">America/New_York (EST)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Language
              </label>
              <select
                value={settings.language}
                onChange={(e) => save({ language: e.target.value })}
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              >
                <option value="cs">Czech</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>
        </section>

        {/* Push Notifications */}
        <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Push Notifications
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Receive browser push notifications even when the tab is closed.
          </p>
          <div className="mt-4">
            {isSupported ? (
              <button
                onClick={isSubscribed ? unsubscribe : subscribe}
                disabled={pushLoading}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  isSubscribed
                    ? "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    : "bg-indigo-600 text-white hover:bg-indigo-700"
                } disabled:opacity-50`}
              >
                {pushLoading
                  ? "..."
                  : isSubscribed
                  ? "Disable push notifications"
                  : "Enable push notifications"}
              </button>
            ) : (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Push notifications are not supported in this browser, or VAPID keys are not configured.
              </p>
            )}
          </div>
        </section>

        {/* Notification Preferences */}
        <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Notification Preferences
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Choose which notifications you want to receive.
          </p>
          <div className="mt-4 space-y-3">
            <Toggle
              label="All notifications"
              description="Master toggle for all notifications"
              checked={settings.notifications.enabled}
              onChange={() => toggleNotifPref("enabled")}
            />
            <div className={settings.notifications.enabled ? "" : "pointer-events-none opacity-40"}>
              <Toggle
                label="Deadline reminders"
                description="24h and 1h before deadline"
                checked={settings.notifications.deadline_reminders}
                onChange={() => toggleNotifPref("deadline_reminders")}
              />
              <Toggle
                label="Forgotten tasks"
                description="Tasks with no updates for 7+ days"
                checked={settings.notifications.forgotten_tasks}
                onChange={() => toggleNotifPref("forgotten_tasks")}
              />
              <Toggle
                label="Morning briefing"
                description="Daily summary at 8:00"
                checked={settings.notifications.morning_briefing}
                onChange={() => toggleNotifPref("morning_briefing")}
              />
              <Toggle
                label="Weekly digest"
                description="Week summary every Friday at 17:00"
                checked={settings.notifications.weekly_digest}
                onChange={() => toggleNotifPref("weekly_digest")}
              />
              <Toggle
                label="Connection suggestions"
                description="When related thoughts are found"
                checked={settings.notifications.connection_suggestions}
                onChange={() => toggleNotifPref("connection_suggestions")}
              />
              <Toggle
                label="Insights"
                description="AI-generated insights about your patterns"
                checked={settings.notifications.insights}
                onChange={() => toggleNotifPref("insights")}
              />
            </div>
          </div>
        </section>

        {/* Quiet Hours */}
        <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Quiet Hours
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Push notifications are paused during quiet hours. In-app notifications still accumulate.
          </p>
          <div className="mt-4 flex items-center gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                From
              </label>
              <input
                type="time"
                value={settings.notifications.quiet_hours_start}
                onChange={(e) => updateQuietHours("quiet_hours_start", e.target.value)}
                className="mt-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <span className="mt-5 text-zinc-400">—</span>
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                To
              </label>
              <input
                type="time"
                value={settings.notifications.quiet_hours_end}
                onChange={(e) => updateQuietHours("quiet_hours_end", e.target.value)}
                className="mt-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
          </div>
        </section>

        {/* Export / Import */}
        <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Export / Import
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Export your thoughts or import from a file.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={() => handleExport("json")}
              disabled={exporting === "json"}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {exporting === "json" ? "Exporting..." : "Export JSON"}
            </button>
            <button
              onClick={() => handleExport("csv")}
              disabled={exporting === "csv"}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {exporting === "csv" ? "Exporting..." : "Export CSV"}
            </button>
            <button
              onClick={() => handleExport("md")}
              disabled={exporting === "md"}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {exporting === "md" ? "Exporting..." : "Export Markdown"}
            </button>
            <button
              onClick={() => setImportOpen(true)}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Import
            </button>
          </div>
        </section>

        {/* Integrations */}
        <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Integrations
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Connect external services to sync your thoughts.
          </p>
          <div className="mt-4 space-y-5">
            {/* Google Calendar */}
            <div className="rounded-lg border border-zinc-100 p-4 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    Google Calendar
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Sync thoughts with deadlines to your calendar.
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    gcalConnected
                      ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                      : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}
                >
                  {gcalConnected ? "Connected" : "Not connected"}
                </span>
              </div>
              {gcalConnected && (
                <div className="mt-3 flex items-center gap-3">
                  <Toggle
                    label="Auto-sync new thoughts"
                    description="Automatically create calendar events for thoughts with deadlines"
                    checked={settings.google_calendar_auto_sync || false}
                    onChange={() => save({ google_calendar_auto_sync: !settings.google_calendar_auto_sync })}
                  />
                </div>
              )}
              {gcalConnected && (
                <button
                  onClick={handleCalendarSync}
                  disabled={syncing}
                  className="mt-3 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  {syncing ? "Syncing..." : "Sync all unsynced thoughts"}
                </button>
              )}
            </div>

            {/* Todoist */}
            <div className="rounded-lg border border-zinc-100 p-4 dark:border-zinc-800">
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Todoist
              </h3>
              <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
                Export tasks to Todoist. Get your API token from Todoist Settings &gt; Integrations.
              </p>
              <input
                type="password"
                placeholder="Todoist API token"
                value={settings.todoist_api_token || ""}
                onChange={(e) => save({ todoist_api_token: e.target.value })}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>

            {/* Notion */}
            <div className="rounded-lg border border-zinc-100 p-4 dark:border-zinc-800">
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Notion
              </h3>
              <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
                Export thoughts to a Notion database.
              </p>
              <div className="space-y-2">
                <input
                  type="password"
                  placeholder="Notion API token (Internal Integration Token)"
                  value={settings.notion_api_token || ""}
                  onChange={(e) => save({ notion_api_token: e.target.value })}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
                <input
                  type="text"
                  placeholder="Notion Database ID"
                  value={settings.notion_database_id || ""}
                  onChange={(e) => save({ notion_database_id: e.target.value })}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Privacy */}
        <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Privacy
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Audio retention, data export, and privacy controls.
          </p>
        </section>
      </div>

      <ImportDialog
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {}}
      />
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{label}</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked ? "bg-indigo-600" : "bg-zinc-300 dark:bg-zinc-600"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}
