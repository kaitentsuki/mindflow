"use client";

import { useState, useMemo, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { MobileSidebarOverlay } from "./MobileSidebarOverlay";
import { KeyboardShortcutsModal } from "./KeyboardShortcutsModal";
import { InstallPrompt } from "./InstallPrompt";
import { useKeyboardShortcuts } from "@/lib/hooks/useKeyboardShortcuts";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const isAuthPage =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/verify-email" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password";

  const shortcuts = useMemo(
    () => ({
      r: () => router.push("/record"),
      R: () => router.push("/record"),
      n: () => router.push("/record"),
      N: () => router.push("/record"),
      "/": () => window.dispatchEvent(new CustomEvent("focus-search")),
      "?": () => setShortcutsOpen(true),
      Escape: () => setShortcutsOpen(false),
    }),
    [router]
  );

  useKeyboardShortcuts(shortcuts);

  // Register service worker
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950">
      <Sidebar />
      <MobileSidebarOverlay
        isOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
      />
      <main className="flex-1 overflow-y-auto p-4 pb-20 md:p-8 md:pb-0">
        {/* Mobile header with hamburger */}
        <div className="mb-4 flex items-center gap-3 md:hidden">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center">
              <span className="text-white font-bold text-xs">M</span>
            </div>
            <span className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              MindFlow
            </span>
          </div>
        </div>
        {children}
      </main>
      <BottomNav />
      <InstallPrompt />
      <KeyboardShortcutsModal
        isOpen={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
    </div>
  );
}
