import { prisma } from "@/lib/db";
import { ThoughtCard } from "@/components/ThoughtCard";

export default async function LibraryPage() {
  let thoughts: Array<{
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
    thoughts = await prisma.thought.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  } catch {
    // DB might not be ready yet
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            Library
          </h1>
          <p className="mt-1 text-zinc-500 dark:text-zinc-400">
            All your captured thoughts.
          </p>
        </div>
        <p className="text-sm text-zinc-400">
          {thoughts.length} thought{thoughts.length !== 1 ? "s" : ""}
        </p>
      </div>

      {thoughts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-12 text-center text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          <p className="text-lg">No thoughts yet</p>
          <p className="mt-1 text-sm">
            Record your first thought or run the seed script.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {thoughts.map((thought) => (
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
  );
}
