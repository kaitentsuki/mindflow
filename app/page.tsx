import { prisma } from "@/lib/db";
import { ThoughtCard } from "@/components/ThoughtCard";

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

  try {
    recentThoughts = await prisma.thought.findMany({
      where: { status: "active" },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
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

      <div className="mb-8 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Total thoughts</p>
          <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            {recentThoughts.length}
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
