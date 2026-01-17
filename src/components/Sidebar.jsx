"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/devices", label: "Devices" },
  { href: "/alerts", label: "Alerts" },
  { href: "/settings", label: "Settings" },
];

export default function Sidebar({ onNavigate }) {
  const pathname = usePathname();

  return (
    <aside className="w-72 shrink-0 border-r border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/60">
      {/* Header */}
      <div className="p-5 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-black text-white dark:bg-white dark:text-black flex items-center justify-center font-bold">
            TS
          </div>
          <div className="min-w-0">
            <div className="font-semibold leading-tight truncate">ThingsString</div>
            <div className="text-xs text-zinc-500 truncate">IoT Platform</div>
          </div>
        </div>
      </div>

      {/* Nav (scrollable on small screens / drawer) */}
      <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-160px)]">
        {nav.map((item) => {
          const active = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => onNavigate?.()} // ✅ closes drawer on mobile
              className={[
                "flex items-center justify-between rounded-xl px-3 py-3 text-sm transition", // ✅ bigger tap area
                active
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-black"
                  : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-900/60",
              ].join(" ")}
            >
              <span className="truncate">{item.label}</span>
              {active && <span className="text-xs opacity-70">•</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 text-xs text-zinc-500">
        v1 • Fleet-ready UI
      </div>
    </aside>
  );
}
