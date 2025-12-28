"use client";

import { logout } from "../lib/auth";
import { useTheme } from "../hooks/useTheme";

export default function Topbar({ title = "Dashboard" }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="h-16 border-b border-zinc-200 bg-white/70 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/60 flex items-center justify-between px-5">
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-zinc-500">Monitor • Control • Alerts</div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          className="rounded-xl border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/60"
        >
          {theme === "dark" ? "Light" : "Dark"}
        </button>

        <button
          onClick={logout}
          className="rounded-xl bg-zinc-900 text-white px-4 py-2 text-sm hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
