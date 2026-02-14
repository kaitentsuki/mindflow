"use client";

import { create } from "zustand";

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
  snoozedUntil?: string | null;
}

interface ThoughtsState {
  thoughts: Map<string, Thought>;

  setThought: (thought: Thought) => void;
  updateThought: (id: string, updates: Partial<Thought>) => void;
  removeThought: (id: string) => void;
}

export const useThoughtsStore = create<ThoughtsState>((set) => ({
  thoughts: new Map(),

  setThought: (thought) =>
    set((state) => {
      const next = new Map(state.thoughts);
      next.set(thought.id, thought);
      return { thoughts: next };
    }),

  updateThought: (id, updates) =>
    set((state) => {
      const next = new Map(state.thoughts);
      const existing = next.get(id);
      if (existing) {
        next.set(id, { ...existing, ...updates });
      }
      return { thoughts: next };
    }),

  removeThought: (id) =>
    set((state) => {
      const next = new Map(state.thoughts);
      next.delete(id);
      return { thoughts: next };
    }),
}));
