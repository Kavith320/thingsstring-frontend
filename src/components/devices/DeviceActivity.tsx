"use client";

/** Who did what on a device (manager+). Backend SHARING_FRONTEND_GUIDE.md §5. */
import { useCallback, useEffect, useState } from "react";
import { Bot, CalendarClock, Download, Lock, Share2, ShieldCheck, ToggleRight, User, Zap } from "lucide-react";
import { ApiError, apiRequest } from "@/lib/api";
import { cn, formatLastSeen, humanizeKey } from "@/lib/utils";
import { Button, Notice } from "@/components/common/ui";

interface Entry {
    ts: string;
    action: string;
    actor?: { type: "user" | "admin" | "automation" | "schedule"; id?: string; email?: string; name?: string };
    details?: any;
}

const FILTERS = [
    { id: "", label: "All" },
    { id: "control", label: "Switching" },
    { id: "schedule", label: "Schedules" },
    { id: "automation", label: "Automations" },
    { id: "share", label: "Sharing" },
];

const ACTION_TEXT: Record<string, string> = {
    "control.update": "changed outputs",
    "schedule.create": "created a schedule",
    "schedule.update": "edited a schedule",
    "schedule.delete": "deleted a schedule",
    "automation.create": "created an automation",
    "automation.update": "edited an automation",
    "automation.delete": "deleted an automation",
    "share.invite": "sent an invitation",
    "share.invite.cancel": "cancelled an invitation",
    "share.accept": "joined the device",
    "share.decline": "declined an invitation",
    "share.role": "changed a role",
    "share.remove": "removed someone",
    "share.leave": "left the device",
    "telemetry.export": "downloaded the data (CSV)",
    "admin.lock": "locked the device",
    "admin.unlock": "unlocked the device",
};

function iconFor(e: Entry) {
    if (e.actor?.type === "automation") return Bot;
    if (e.actor?.type === "schedule") return CalendarClock;
    if (e.actor?.type === "admin") return ShieldCheck;
    if (e.action.startsWith("control")) return ToggleRight;
    if (e.action.startsWith("share")) return Share2;
    if (e.action.startsWith("telemetry")) return Download;
    if (e.action.startsWith("admin")) return Lock;
    if (e.action.startsWith("automation")) return Zap;
    if (e.action.startsWith("schedule")) return CalendarClock;
    return User;
}

function actorName(e: Entry) {
    const a = e.actor;
    if (!a) return "Someone";
    if (a.type === "automation") return `Automation “${a.name || "rule"}”`;
    if (a.type === "schedule") return `Schedule “${a.name || "schedule"}”`;
    if (a.type === "admin") return `Admin${a.name ? ` ${a.name}` : ""}`;
    return a.name || a.email || "Someone";
}

/** One-line summary of the details we know how to read. */
function detailText(e: Entry): string {
    const d = e.details || {};
    const parts: string[] = [];
    if (d.actuators && typeof d.actuators === "object") {
        for (const [k, v] of Object.entries<any>(d.actuators)) {
            const val = v?.state ?? v?.status ?? v?.value ?? (typeof v?.auto === "boolean" ? (v.auto ? "AUTO" : "MANUAL") : undefined);
            parts.push(`${humanizeKey(k)} → ${typeof val === "boolean" ? (val ? "ON" : "OFF") : val ?? "changed"}`);
        }
    }
    if (d.reading && typeof d.reading === "object") {
        parts.push("because " + Object.entries<any>(d.reading).map(([k, v]) => `${humanizeKey(k)} was ${v}`).join(", "));
    }
    if (d.email) parts.push(String(d.email));
    if (d.role) parts.push(`as ${d.role}`);
    if (d.name && !d.actuators) parts.push(`“${d.name}”`);
    return parts.join(" · ");
}

export default function DeviceActivity({ deviceId }: { deviceId: string }) {
    const [filter, setFilter] = useState("");
    const [items, setItems] = useState<Entry[] | null>(null);
    const [next, setNext] = useState<string | null>(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState("");
    const [hidden, setHidden] = useState(false);

    const fetchPage = useCallback(
        (before?: string) => {
            const qs = new URLSearchParams({ limit: "30" });
            if (before) qs.set("before", before);
            if (filter) qs.set("action", filter);
            return apiRequest(`/api/devices/${encodeURIComponent(deviceId)}/activity?${qs}`, { quiet: true });
        },
        [deviceId, filter]
    );

    useEffect(() => {
        let alive = true;
        fetchPage()
            .then((r: any) => {
                if (!alive) return;
                setItems(r.activity || []);
                setNext(r.nextBefore || null);
                setError("");
            })
            .catch((e) => {
                if (!alive) return;
                // Older backends (no route) or not allowed: just don't show the section
                if (e instanceof ApiError && (e.status === 404 || e.code === "DEVICE_ROLE_TOO_LOW")) setHidden(true);
                else setError(e.message || "Couldn't load the history.");
            });
        return () => {
            alive = false;
        };
    }, [fetchPage]);

    async function loadMore() {
        if (!next) return;
        setLoadingMore(true);
        try {
            const r: any = await fetchPage(next);
            setItems((cur) => [...(cur || []), ...(r.activity || [])]);
            setNext(r.nextBefore || null);
        } catch (e: any) {
            setError(e.message || "Couldn't load more.");
        } finally {
            setLoadingMore(false);
        }
    }

    if (hidden) return null;

    return (
        <section className="rounded-2xl border shadow-sm border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3.5 sm:px-6 dark:border-zinc-800">
                <h3 className="font-semibold text-zinc-900 dark:text-white">Activity</h3>
                <div role="tablist" aria-label="Filter activity" className="-mx-1 flex max-w-full gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {FILTERS.map((f) => (
                        <button
                            key={f.id}
                            type="button"
                            role="tab"
                            aria-selected={filter === f.id}
                            onClick={() => {
                                setItems(null);
                                setFilter(f.id);
                            }}
                            className={cn(
                                "h-8 shrink-0 rounded-full border px-3 text-xs font-semibold",
                                filter === f.id ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900" : "border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
                            )}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>
            <div className="p-4 sm:p-6">
                {error && <Notice tone="error" className="mb-3">{error}</Notice>}
                {items === null ? (
                    <div className="space-y-2" aria-hidden>{[0, 1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />)}</div>
                ) : items.length === 0 ? (
                    <p className="text-sm text-zinc-500">Nothing here yet. History is kept for 90 days.</p>
                ) : (
                    <ol className="space-y-1">
                        {items.map((e, i) => {
                            const Icon = iconFor(e);
                            const detail = detailText(e);
                            const t = new Date(e.ts);
                            return (
                                <li key={`${e.ts}-${i}`} className="flex gap-3 rounded-xl px-2 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                                    <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"><Icon className="h-4 w-4" /></span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm text-zinc-800 dark:text-zinc-200">
                                            <b className="font-semibold">{actorName(e)}</b> {ACTION_TEXT[e.action] || e.action}
                                        </p>
                                        {detail && <p className="truncate text-xs text-zinc-500" title={detail}>{detail}</p>}
                                    </div>
                                    <time dateTime={e.ts} title={t.toLocaleString()} className="shrink-0 text-xs text-zinc-500">{formatLastSeen(t.getTime())}</time>
                                </li>
                            );
                        })}
                    </ol>
                )}
                {next && items && items.length > 0 && (
                    <div className="mt-3 flex justify-center">
                        <Button variant="ghost" onClick={loadMore} loading={loadingMore}>Load older</Button>
                    </div>
                )}
            </div>
        </section>
    );
}
