"use client";

import { usePathname } from "next/navigation";
import { Menu, Sparkles } from "lucide-react";

/** Page title for the current route (longest matching prefix wins). */
const TITLES = [
  [/^\/devices\/[^/]+\/schedules/, "Schedules"],
  [/^\/devices\/[^/]+/, "Device"],
  [/^\/devices/, "Devices"],
  [/^\/automation/, "Automation"],
  [/^\/ai/, "ThingsString AI"],
  [/^\/settings/, "Settings"],
  [/^\/dashboard/, "Dashboard"],
];

export default function Topbar({ onMenuClick }) {
  const pathname = usePathname() || "";
  const title = TITLES.find(([re]) => re.test(pathname))?.[1] || "ThingsString";
  const onAiPage = pathname.startsWith("/ai");

  return (
    <header className="sticky top-0 z-30 h-14 sm:h-16 border-b border-zinc-200 bg-white/85 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/85">
      <div className="h-full px-3 sm:px-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            type="button"
            onClick={onMenuClick}
            className="md:hidden -ml-1 grid h-10 w-10 place-items-center rounded-xl text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-base sm:text-lg font-semibold truncate text-zinc-900 dark:text-zinc-100">
            {title}
          </h1>
        </div>

        {!onAiPage && (
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("open-ai-copilot"))}
            className="flex h-10 items-center gap-1.5 rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-3 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-500/20 dark:text-indigo-400"
            aria-label="Open ThingsString AI assistant"
            title="ThingsString AI (Ctrl+K)"
          >
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">Ask AI</span>
          </button>
        )}
      </div>
    </header>
  );
}
