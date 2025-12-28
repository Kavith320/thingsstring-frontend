"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/devices", label: "Devices" },
  { href: "/alerts", label: "Alerts" },
  { href: "/settings", label: "Settings" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-72 shrink-0 border-r border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/60">
      <div className="p-5 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-black text-white dark:bg-white dark:text-black flex items-center justify-center font-bold">
            TS
          </div>
          <div>
            <div className="font-semibold leading-tight">ThingsString</div>
            <div className="text-xs text-zinc-500">IoT Platform</div>
          </div>
        </div>
      </div>

      <nav className="p-3 space-y-1">
        {nav.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex items-center justify-between rounded-xl px-3 py-2 text-sm transition",
                active
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-black"
                  : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-900/60",
              ].join(" ")}
            >
              <span>{item.label}</span>
              {active && (
                <span className="text-xs opacity-70">•</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 text-xs text-zinc-500">
        v1 • Fleet-ready UI
      </div>
    </aside>
  );
}
