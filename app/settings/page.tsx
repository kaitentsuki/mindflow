export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-2 text-3xl font-bold text-zinc-900 dark:text-zinc-100">
        Settings
      </h1>
      <p className="mb-8 text-zinc-500 dark:text-zinc-400">
        Configure your MindFlow preferences.
      </p>

      <div className="space-y-6">
        <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Profile
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            User profile settings will be available here.
          </p>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Notifications
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Push notification preferences will be configurable here (Phase 3).
          </p>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Privacy
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Audio retention, data export, and privacy controls.
          </p>
        </section>
      </div>
    </div>
  );
}
