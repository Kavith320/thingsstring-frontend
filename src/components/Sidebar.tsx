"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Radio,
    Bot,
    Settings,
    LogOut,
    Zap,
    Map as MapIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logout } from "@/lib/auth";
import { useProfile } from "@/lib/profile";
import { Avatar } from "@/lib/icons";
import Logo from "@/components/common/Logo";

const nav = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/devices", label: "Devices", icon: Radio },
    { href: "/map", label: "Map", icon: MapIcon },
    { href: "/automation", label: "Automation", icon: Zap },
    { href: "/ai", label: "ThingsString AI", icon: Bot },
    { href: "/settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
    onNavigate?: () => void;
}

export default function Sidebar({ onNavigate }: SidebarProps) {
    const pathname = usePathname();
    const user = useProfile().profile;

    return (
        <aside className="flex flex-col h-full bg-zinc-50/50 backdrop-blur-xl dark:bg-zinc-950/80 border-r border-zinc-200 dark:border-zinc-800">
            {/* Header */}
            <div className="p-5 sm:p-6 italic">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-black dark:bg-zinc-900 flex items-center justify-center p-2 border border-zinc-200 dark:border-zinc-800 shadow-sm shadow-indigo-500/5">
                        <Logo strokeWidth={26} nodeRadius={28} />
                    </div>
                    <div className="min-w-0">
                        <div className="font-bold leading-tight truncate text-zinc-900 dark:text-zinc-100">ThingsString</div>
                        <div className="text-xs font-medium text-zinc-500 truncate">IoT Platform</div>
                    </div>
                </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
                <div className="text-xs font-semibold text-zinc-400 px-3 mb-2 uppercase tracking-wider">Menu</div>
                {nav.map((item) => {
                    const active = pathname === item.href || pathname.startsWith(item.href + "/");
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => onNavigate?.()}
                            className={cn(
                                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                                active
                                    ? "bg-zinc-900 text-white shadow-md shadow-zinc-900/10 dark:bg-white dark:text-black"
                                    : "text-zinc-600 hover:bg-zinc-200/50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                            )}
                        >
                            <Icon className={cn("w-5 h-5", active ? "text-white dark:text-black" : "text-zinc-400 group-hover:text-zinc-600 dark:text-zinc-500 dark:group-hover:text-zinc-300")} />
                            <span className="truncate">{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

            {/* Footer / Profile */}
            <div className="p-4 mt-auto border-t border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-2 p-2 rounded-xl bg-white border border-zinc-200 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                    <Link href="/settings" onClick={() => onNavigate?.()} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-0.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/60" title="Profile & settings">
                        <Avatar value={user?.avatar} name={user?.name} size={36} />
                        <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate">{user?.name || "User"}</div>
                            <div className="text-xs text-zinc-500 truncate">{user?.email || ""}</div>
                        </div>
                    </Link>
                    <button
                        type="button"
                        onClick={logout}
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-zinc-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30"
                        title="Log out"
                        aria-label="Log out"
                    >
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </aside>
    );
}
