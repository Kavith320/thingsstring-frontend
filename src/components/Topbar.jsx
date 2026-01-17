"use client";

import { MoreVertical, LogOut } from "lucide-react";
import { logout } from "@/lib/auth/actions";

export default function Topbar({
  title = "Dashboard",
  onMenuClick, // 👈 passed from DashboardLayout
}) {
  return (
    <header className="sticky top-0 z-30 h-16 border-b border-zinc-200 bg-white/70 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/60">
      <div className="h-full px-4 sm:px-6 flex items-center justify-between gap-3">
        {/* Left side */}
        <div className="flex items-center gap-2 min-w-0">
          {/* Mobile: 3-dots */}
          <button
            onClick={onMenuClick}
            className="md:hidden rounded-xl p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Open menu"
          >
            <MoreVertical className="h-5 w-5" />
          </button>

          <div className="min-w-0">
            <div className="text-sm sm:text-base font-semibold truncate">
              {title}
            </div>
            <div className="hidden sm:block text-xs text-zinc-500">
              Monitor • Control • Alerts
            </div>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <button
            onClick={logout}
            className="
              flex items-center gap-2
              rounded-xl bg-zinc-900 text-white
              px-3 py-2 text-sm
              hover:bg-zinc-800
              dark:bg-white dark:text-black dark:hover:bg-zinc-200
            "
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
