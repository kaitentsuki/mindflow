"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { SearchBar } from "./SearchBar";
import { LibraryFilters } from "./LibraryFilters";
import { ThoughtCard } from "./ThoughtCard";

interface Thought {
  id: string;
  type: string;
  priority: number;
  summary: string | null;
  cleanedText: string;
  status: string;
  categories: string[];
  deadline: string | null;
  createdAt: string;
  score?: number;
}

export function LibraryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [type, setType] = useState(searchParams.get("type") || "");
  const [priority, setPriority] = useState(searchParams.get("priority") || "");
  const [category, setCategory] = useState(searchParams.get("category") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "active");
  const [dateFrom, setDateFrom] = useState(searchParams.get("dateFrom") || "");
  const [dateTo, setDateTo] = useState(searchParams.get("dateTo") || "");

  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearchMode, setIsSearchMode] = useState(!!searchParams.get("q"));

  // Update URL params
  const updateURL = useCallback((params: Record<string, string>) => {
    const url = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v) url.set(k, v);
    });
    const str = url.toString();
    router.replace(`/library${str ? `?${str}` : ""}`, { scroll: false });
  }, [router]);

  // Fetch data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      if (query) {
        // Search mode: use /api/search
        setIsSearchMode(true);
        const res = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query,
            type: type || undefined,
            priority: priority ? parseInt(priority) : undefined,
            category: category || undefined,
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
            limit: 50,
          }),
        });
        const data = await res.json();
        setThoughts(data.results || []);
        setTotal(data.total || 0);
      } else {
        // Browse mode: use /api/thoughts
        setIsSearchMode(false);
        const params = new URLSearchParams();
        if (type) params.set("type", type);
        if (status) params.set("status", status);
        if (priority) params.set("priority", priority);
        if (category) params.set("category", category);
        if (dateFrom) params.set("dateFrom", dateFrom);
        if (dateTo) params.set("dateTo", dateTo);
        params.set("limit", "50");

        const res = await fetch(`/api/thoughts?${params}`);
        const data = await res.json();
        setThoughts(
          (data.thoughts || []).map((t: Record<string, unknown>) => ({
            ...t,
            deadline: t.deadline ? new Date(t.deadline as string).toISOString() : null,
            createdAt: new Date(t.createdAt as string).toISOString(),
          }))
        );
        setTotal(data.total || 0);
      }
    } catch {
      setThoughts([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [query, type, priority, category, status, dateFrom, dateTo]);

  // Fetch on filter change
  useEffect(() => {
    fetchData();
    updateURL({ q: query, type, priority, category, status, dateFrom, dateTo });
  }, [query, type, priority, category, status, dateFrom, dateTo]);

  const handleFilterChange = (filters: Record<string, string>) => {
    setType(filters.type);
    setPriority(filters.priority);
    setCategory(filters.category);
    setStatus(filters.status);
    setDateFrom(filters.dateFrom);
    setDateTo(filters.dateTo);
  };

  return (
    <div className="space-y-4">
      <SearchBar
        value={query}
        onChange={setQuery}
        isLoading={isLoading}
      />

      <LibraryFilters
        type={type}
        priority={priority}
        category={category}
        status={status}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onChange={handleFilterChange}
      />

      {/* Results count */}
      <div className="flex items-center justify-between text-sm text-zinc-500">
        <p>
          {isSearchMode && query ? `Search results for "${query}"` : "All thoughts"}
          {" \u2014 "}{total} result{total !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Results */}
      {isLoading && thoughts.length === 0 ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
          ))}
        </div>
      ) : thoughts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-12 text-center text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          <p className="text-lg">
            {query ? "No results found" : "No thoughts yet"}
          </p>
          <p className="mt-1 text-sm">
            {query ? "Try different keywords or remove some filters" : "Record your first thought or run the seed script."}
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
              deadline={thought.deadline}
              createdAt={thought.createdAt}
              similarity={thought.score}
              onUpdate={fetchData}
            />
          ))}
        </div>
      )}
    </div>
  );
}
