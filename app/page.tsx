import { prisma } from "@/lib/db";
import { ThoughtCard } from "@/components/ThoughtCard";
import { InsightsWidget } from "./InsightsWidget";
import { OnboardingFlow } from "@/components/OnboardingFlow";

export default async function DashboardPage() {
  let recentThoughts: Array<{
    id: string;
    type: string;
    priority: number;
    summary: string | null;
    cleanedText: string;
    status: string;
    categories: string[];
    deadline: Date | null;
    createdAt: Date;
  }> = [];

  let briefing: { title: string; body: string | null; createdAt: Date } | null = null;
  let totalThoughts = 0;

  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [thoughts, briefingNotif, count] = await Promise.all([
      prisma.thought.findMany({
        where: { status: "active" },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.notification.findFirst({
        where: {
          type: "morning_briefing",
          createdAt: { gte: todayStart },
        },
        orderBy: { createdAt: "desc" },
        select: { title: true, body: true, createdAt: true },
      }),
      prisma.thought.count(),
    ]);

    recentThoughts = thoughts;
    briefing = briefingNotif;
    totalThoughts = count;
  } catch {
    // DB might not be ready yet
  }

  const tasks = recentThoughts.filter((t) => t.type === "task");
  const upcoming = recentThoughts.filter(
    (t) => t.deadline && new Date(t.deadline) > new Date()
  );

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
          Dashboard
        </h1>
        <p className="mt-1 text-zinc-500 dark:text-zinc-400">
          Welcome to MindFlow — your voice-first AI assistant.
        </p>
      </div>

      <OnboardingFlow />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Total thoughts</p>
          <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            {totalThoughts}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Active tasks</p>
          <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            {tasks.length}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Upcoming deadlines</p>
          <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            {upcoming.length}
          </p>
        </div>
      </div>

      {/* Morning Briefing + Insights row */}
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Morning Briefing */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
          <div className="mb-3 flex items-center gap-2">
            <svg className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" />
            </svg>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Morning Briefing
            </h2>
          </div>
          {briefing ? (
            <p className="whitespace-pre-line text-sm text-zinc-600 dark:text-zinc-400">
              {briefing.body}
            </p>
          ) : (
            <p className="text-sm text-zinc-400 dark:text-zinc-500">
              No briefing today yet. Briefings are generated daily at 8:00.
            </p>
          )}
        </div>

        {/* Insights — client component, lazy loaded */}
        <InsightsWidget totalThoughts={totalThoughts} />
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Recent thoughts
        </h2>
        {recentThoughts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            No thoughts yet. Start recording or add one manually.
          </div>
        ) : (
          <div className="space-y-3">
            {recentThoughts.map((thought) => (
              <ThoughtCard
                key={thought.id}
                id={thought.id}
                type={thought.type}
                priority={thought.priority}
                summary={thought.summary}
                cleanedText={thought.cleanedText}
                status={thought.status}
                categories={thought.categories}
                deadline={thought.deadline?.toISOString() ?? null}
                createdAt={thought.createdAt.toISOString()}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
