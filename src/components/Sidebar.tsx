"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Radio,
    Bot,
    Settings,
    LogOut,
    User,
    Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getUser, logout } from "@/lib/auth";
import { useEffect, useState } from "react";

const nav = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/devices", label: "Devices", icon: Radio },
    { href: "/automation", label: "Automation", icon: Zap },
    { href: "/ai", label: "AI Assistant", icon: Bot },
    { href: "/settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
    onNavigate?: () => void;
}

export default function Sidebar({ onNavigate }: SidebarProps) {
    const pathname = usePathname();
    const [user, setUser] = useState<{ name: string, email: string } | null>(null);

    useEffect(() => {
        setUser(getUser());
    }, []);

    return (
        <aside className="flex flex-col h-full bg-zinc-50/50 backdrop-blur-xl dark:bg-zinc-950/80 border-r border-zinc-200 dark:border-zinc-800">
            {/* Header */}
            <div className="p-5 sm:p-6 italic">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-black text-white dark:bg-white dark:text-black flex items-center justify-center font-bold">
                        TS
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
                <div className="flex items-center gap-3 p-2 rounded-xl bg-white border border-zinc-200 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                    <div className="h-9 w-9 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-zinc-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{user?.name || "User"}</div>
                        <div className="text-[10px] text-zinc-500 truncate">{user?.email || ""}</div>
                    </div>
                    <button
                        onClick={logout}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-zinc-400 hover:text-red-500 transition dark:hover:bg-red-950/30"
                        title="Log out"
                    >
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </aside>
    );
}
