import { Suspense } from "react";
import { LibraryContent } from "@/components/LibraryContent";

export default function LibraryPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
          Library
        </h1>
        <p className="mt-1 text-zinc-500 dark:text-zinc-400">
          Search and browse your captured thoughts.
        </p>
      </div>

      <Suspense fallback={
        <div className="space-y-3">
          <div className="h-10 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
          <div className="h-8 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
          ))}
        </div>
      }>
        <LibraryContent />
      </Suspense>
    </div>
  );
}
