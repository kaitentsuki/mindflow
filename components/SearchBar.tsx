"use client";

import { useState, useEffect, useRef } from "react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  isLoading?: boolean;
  placeholder?: string;
}

export function SearchBar({ value, onChange, isLoading, placeholder = "Search thoughts..." }: SearchBarProps) {
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout>(undefined);

  // Sync external value
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Debounce
  useEffect(() => {
    timerRef.current = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue);
      }
    }, 300);
    return () => clearTimeout(timerRef.current);
  }, [localValue]);

  // "/" keyboard shortcut to focus (handled via custom event from AppShell)
  useEffect(() => {
    const handleFocusSearch = () => {
      inputRef.current?.focus();
    };
    window.addEventListener("focus-search", handleFocusSearch);
    return () => window.removeEventListener("focus-search", handleFocusSearch);
  }, []);

  return (
    <div className="relative">
      <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        ref={inputRef}
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-zinc-300 bg-white py-2.5 pl-10 pr-10 text-sm outline-none transition-colors focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
      />
      {isLoading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-indigo-500" />
        </div>
      )}
      {!isLoading && !localValue && (
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-zinc-300 px-1.5 py-0.5 text-xs text-zinc-400 dark:border-zinc-600">
          /
        </kbd>
      )}
      {localValue && !isLoading && (
        <button
          onClick={() => { setLocalValue(""); onChange(""); }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
        >
          ✕
        </button>
      )}
    </div>
  );
}
