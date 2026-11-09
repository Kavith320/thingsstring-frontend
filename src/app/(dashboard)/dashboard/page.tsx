"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { apiRequest, loadUntilOk } from "@/lib/api";
import StatusPill from "@/components/common/StatusPill";
import {
    Thermometer,
    Droplets,
    Zap,
    Cpu,
    Wifi,
    Activity,
    Gauge,
    Wind,
    Sun,
    Battery,
    Search,
    Radio,
    Power,
    ChevronRight,
    ChevronDown,
    WifiOff,
    FolderKanban,
    Users,
    LayoutGrid,
    GripVertical,
    ChevronLeft,
    Eye,
    EyeOff,
    RotateCcw,
} from "lucide-react";
import {
    useDashboardLayout,
    orderIds,
    cardSpan,
    GRID_COLS,
    DEFAULT_LAYOUT,
    type CardSize,
    type DashboardLayout,
} from "@/lib/dashboardLayout";
import { Button, IconBadge } from "@/components/common/ui";
import GroupsModal, { type DeviceGroup } from "@/components/dashboard/GroupsModal";
import { IconRef } from "@/lib/icons";
import { convertReading, useUnits } from "@/lib/profile";
import { arrangeEntries, deviceDisplayName, deviceId, deviceOnline, deviceRole, deviceUi, getPath, sensorKeys, ROLE_LABELS, type DeviceRole } from "@/lib/deviceUi";
import PendingInvites from "@/components/dashboard/PendingInvites";
import {
    cn,
    formatLastSeen,
    getLastTelemetryMs,
    isActuatorAuto,
    toOnOff,
} from "@/lib/utils";

/* -------- Types -------- */
interface Device {
    _id?: string;
    deviceId?: string;
    name?: string;
    last_telemetry?: Record<string, any> | null;
    config?: {
        device?: { name?: string; model?: string; device_id?: string };
        actuators?: Record<string, any>;
    };
    control?: { actuators?: Record<string, any> } | null;
    ui?: any;
    status?: { online?: boolean; lastSeen?: string | null };
    role?: string;
    sharedBy?: { name?: string; email?: string } | null;
}

/** `icon` is a default icon component; `iconRef` a user-chosen icon reference */
interface Sensor { key: string; label: string; value: number; unit: string; icon: any; iconRef: string | null; color: string | null }
interface Actuator { key: string; label: string; state: "ON" | "OFF"; auto: boolean }
interface DeviceRow {
    id: string;
    name: string;
    model: string;
    icon: string | null;
    color: string | null;
    online: boolean;
    lastSeenMs: number | null;
    /** readings for the card: pinned ones if any are pinned, otherwise all visible */
    sensors: Sensor[];
    /** every visible reading, pinned first (large cards show more) */
    allSensors: Sensor[];
    /** controls for the card: pinned ones if any are pinned, otherwise all visible */
    actuators: Actuator[];
    /** every actuator, for the summary counts */
    allActuators: Actuator[];
    /** who shared it with me (null for my own devices) and my role */
    sharedBy: string | null;
    role: DeviceRole;
}

/* -------- Sensor helpers -------- */
const NON_SENSOR_KEYS = new Set([
    "ts", "timestamp", "created_at", "createdAt", "updatedAt", "_id", "__v", "actuators", "UP", "up", "id", "uid",
    "uuid", "deviceId", "device_id", "chipId", "chip_id", "time", "date", "meta", "raw",
]);
const MAX_SENSORS_ON_CARD = 4;

function getIconForKey(key: string) {
    const k = key.toLowerCase();
    if (k.includes("temp")) return Thermometer;
    if (k.includes("hum") || k.includes("moist") || k.includes("water")) return Droplets;
    if (k.includes("vol") || k.includes("batt")) return Battery;
    if (k.includes("cur") || k.includes("pwr") || k.includes("watt")) return Zap;
    if (k.includes("cpu") || k.includes("mem")) return Cpu;
    if (k.includes("sig") || k.includes("rssi")) return Wifi;
    if (k.includes("press")) return Gauge;
    if (k.includes("wind") || k.includes("co2") || k.includes("pm")) return Wind;
    if (k.includes("light") || k.includes("lux")) return Sun;
    return Activity;
}

function getUnitForKey(key: string) {
    const k = key.toLowerCase();
    if (k.includes("temp")) return "°C";
    if (k.includes("hum") || k.includes("moist") || k.includes("batt") || k.includes("level")) return "%";
    if (k.includes("vol")) return "V";
    if (k.includes("cur")) return "A";
    if (k.includes("pres")) return "hPa";
    if (k.includes("lux") || k === "light") return "lx";
    if (k.includes("rssi")) return "dBm";
    if (k.includes("co2")) return "ppm";
    return "";
}

function formatValue(v: number) {
    return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function toRow(d: Device, units: "metric" | "imperial"): DeviceRow {
    const id = deviceId(d) || "-";
    const last: any = d?.last_telemetry || {};
    const ui = deviceUi(d);

    // Readings: numeric fields, in the user's saved order, hidden ones left out
    const numericKeys = sensorKeys(last).filter((k) => {
        const v = getPath(last, k);
        return !NON_SENSOR_KEYS.has(k) && typeof v === "number" && Number.isFinite(v);
    });
    const visibleSensors = arrangeEntries(numericKeys, ui.sensors).filter((e) => e.visible);
    const pinnedSensors = visibleSensors.filter((e) => e.pinned);
    const toSensor = (e: (typeof visibleSensors)[number]): Sensor => {
        const leaf = e.key.split(".").pop() || e.key;
        const conv = convertReading(getPath(last, e.key), e.unit || getUnitForKey(leaf), units);
        return { key: e.key, label: e.title, value: conv.value, unit: conv.unit, icon: getIconForKey(leaf), iconRef: e.icon, color: e.color };
    };
    const sensors = (pinnedSensors.length ? pinnedSensors : visibleSensors).map(toSensor);
    const allSensors = [...pinnedSensors, ...visibleSensors.filter((e) => !e.pinned)].map(toSensor);

    // Desired state + mode come from device_control (what the backend acts on); the
    // device's own report in telemetry wins for the live ON/OFF when present.
    const control = d?.control?.actuators || {};
    const config = d?.config?.actuators || {};
    const reported = last.actuators || {};
    const keys = [...new Set([...Object.keys(control), ...Object.keys(config), ...Object.keys(reported)])];
    const toActuator = (key: string, label: string): Actuator => {
        const ctl = control[key] ?? config[key];
        const live = reported[key] ?? ctl?.state ?? ctl?.status ?? ctl?.value ?? ctl?.default?.state;
        return { key, label, state: toOnOff(live), auto: isActuatorAuto(ctl) };
    };
    const arranged = arrangeEntries(keys, ui.actuators);
    const visibleActs = arranged.filter((e) => e.visible);
    const pinnedActs = visibleActs.filter((e) => e.pinned);

    return {
        id,
        name: deviceDisplayName(d),
        model: d?.config?.device?.model || "Device",
        icon: ui.icon,
        color: ui.color,
        online: deviceOnline(d),
        lastSeenMs: getLastTelemetryMs(last),
        sensors,
        allSensors,
        actuators: (pinnedActs.length ? pinnedActs : visibleActs).map((e) => toActuator(e.key, e.title)),
        allActuators: arranged.map((e) => toActuator(e.key, e.title)),
        sharedBy: d?.sharedBy ? d.sharedBy.name || d.sharedBy.email || "someone" : null,
        role: deviceRole(d),
    };
}

const GROUPS_LOCAL_KEY = "ts_dashboard_groups";

/* -------- Page -------- */
export default function DashboardPage() {
    const [devices, setDevices] = useState<Device[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [query, setQuery] = useState("");

    // Consecutive failed polls. One dropped request is normal on a flaky link,
    // so only surface a warning once several polls in a row have failed.
    const failCount = useRef(0);

    async function loadDevices() {
        try {
            const data: any = await apiRequest("/api/devices", { method: "GET" });
            const list: Device[] = Array.isArray(data) ? data : (data?.devices || []);
            setDevices(list);
            failCount.current = 0;
            setError("");
        } catch (e: any) {
            failCount.current += 1;
            if (failCount.current >= 3) {
                setError(`${e.message || "Failed to load devices"} Showing the last received data.`);
            }
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadDevices();
        const id = setInterval(loadDevices, 5000);
        return () => clearInterval(id);
    }, []);

    const units = useUnits();
    const allRows = useMemo(() => devices.map((d) => toRow(d, units)), [devices, units]);
    const rowById = useMemo(() => new Map(allRows.map((r) => [r.id, r])), [allRows]);

    // Device groups (sections). Loaded once; the list is edited in the groups dialog.
    // A browser copy shows them instantly; the server copy keeps retrying through connection
    // drops, so one failed request no longer leaves the dashboard without its groups.
    const [groups, setGroupsState] = useState<DeviceGroup[]>([]);
    const [groupsSupported, setGroupsSupported] = useState(true);
    const [managingGroups, setManagingGroups] = useState(false);
    const setGroups = (next: DeviceGroup[] | ((gs: DeviceGroup[]) => DeviceGroup[])) =>
        setGroupsState((gs) => {
            const value = typeof next === "function" ? next(gs) : next;
            try {
                localStorage.setItem(GROUPS_LOCAL_KEY, JSON.stringify(value));
            } catch {
                // storage blocked: the server copy still works
            }
            return value;
        });
    useEffect(() => {
        try {
            const cached = JSON.parse(localStorage.getItem(GROUPS_LOCAL_KEY) || "null");
            // Browser storage is only readable after hydration
            if (Array.isArray(cached)) setGroupsState(cached);
        } catch {
            // no usable copy
        }
        return loadUntilOk<{ groups?: DeviceGroup[] }>(
            "/api/groups",
            (r) => setGroups(Array.isArray(r?.groups) ? r.groups : []),
            (e) => {
                if (/not found/i.test((e as Error)?.message || "")) setGroupsSupported(false);
            }
        );
    }, []);

    // Grid layout (order, sizes, hidden cards, columns) and its edit mode
    const { layout, save: saveLayout, serverSupported: layoutOnServer } = useDashboardLayout();
    const [draft, setDraft] = useState<DashboardLayout | null>(null);
    const [dragId, setDragId] = useState<string | null>(null);
    const [savingLayout, setSavingLayout] = useState(false);
    const [layoutError, setLayoutError] = useState("");
    const editing = draft !== null;
    const active = draft || layout;

    function startEditing() {
        setLayoutError("");
        setDraft(structuredClone(layout));
    }
    async function finishEditing() {
        if (!draft) return;
        setSavingLayout(true);
        setLayoutError("");
        try {
            await saveLayout(draft);
            setDraft(null);
        } catch (e: any) {
            setLayoutError(e?.message || "Couldn't save the layout.");
        } finally {
            setSavingLayout(false);
        }
    }
    const setCard = (id: string, patch: { size?: CardSize; hidden?: boolean }) =>
        setDraft((d) => d && { ...d, cards: { ...d.cards, [id]: { ...d.cards[id], ...patch } } });
    function moveCard(sectionKey: string, ids: string[], id: string, toIndex: number) {
        const from = ids.indexOf(id);
        if (from < 0 || toIndex < 0 || toIndex >= ids.length || from === toIndex) return;
        const next = [...ids];
        next.splice(from, 1);
        next.splice(toIndex, 0, id);
        setDraft((d) => d && { ...d, order: { ...d.order, [sectionKey]: next } });
    }

    function toggleCollapsed(g: DeviceGroup) {
        const collapsed = !g.collapsed;
        setGroups((gs) => gs.map((x) => (x.id === g.id ? { ...x, collapsed } : x)));
        apiRequest(`/api/groups/${g.id}`, { method: "PATCH", body: { collapsed }, quiet: true }).catch(() => {
            // Only a remembered fold; keep the local state even if saving fails
        });
    }

    const rows = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return allRows;
        return allRows.filter((r) => r.name.toLowerCase().includes(q) || String(r.id).toLowerCase().includes(q));
    }, [allRows, query]);

    const { sections, hiddenCount } = useMemo(() => {
        const matching = new Set(rows.map((r) => r.id));
        const isHidden = (id: string) => !!active.cards[id]?.hidden;
        let hiddenCount = 0;
        const grouped = new Set<string>();
        const out: { key: string; group: DeviceGroup | null; title?: string; ids: string[]; rows: DeviceRow[] }[] = [];
        const build = (key: string, group: DeviceGroup | null, ids: string[]) => {
            const ordered = orderIds(ids, active.order[key]);
            const shown = ordered.filter((id) => matching.has(id) && (editing || !isHidden(id)));
            hiddenCount += ordered.filter((id) => matching.has(id) && isHidden(id)).length;
            return { key, group, ids: ordered, rows: shown.map((id) => rowById.get(id)!).filter(Boolean) };
        };
        for (const g of groups) {
            g.deviceIds.forEach((id) => grouped.add(id));
            const sec = build(g.id, g, g.deviceIds.filter((id) => rowById.has(id)));
            if (sec.rows.length || (!query && !editing)) out.push(sec);
        }
        // Not in a group: my own devices, then the ones other people shared with me
        const ungrouped = allRows.filter((r) => !grouped.has(r.id));
        const rest = build("ungrouped", null, ungrouped.filter((r) => !r.sharedBy).map((r) => r.id));
        if (rest.rows.length) out.push({ ...rest, title: groups.length ? "Other devices" : undefined });
        const shared = build("shared", null, ungrouped.filter((r) => r.sharedBy).map((r) => r.id));
        if (shared.rows.length) out.push({ ...shared, title: "Shared with me" });
        return { sections: out, hiddenCount: editing ? 0 : hiddenCount };
    }, [rows, allRows, groups, rowById, query, active, editing]);

    const stats = useMemo(() => {
        const online = allRows.filter((r) => r.online).length;
        const acts = allRows.flatMap((r) => r.allActuators);
        return {
            total: allRows.length,
            online,
            offline: allRows.length - online,
            actsOn: acts.filter((a) => a.state === "ON").length,
            actsTotal: acts.length,
        };
    }, [allRows]);

    const firstLoad = loading && devices.length === 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">Overview</h2>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Live status of your devices, refreshed every 5 seconds</p>
                </div>
                <div className="flex w-full gap-2 sm:w-auto">
                <label className="relative min-w-0 flex-1 sm:w-72 sm:flex-none">
                    <span className="sr-only">Search devices</span>
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search devices…"
                        className="h-11 w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/5 dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-zinc-600"
                    />
                </label>
                {groupsSupported && (
                    <Button onClick={() => setManagingGroups(true)} aria-label="Manage groups" title="Group devices into sections" disabled={editing}>
                        <FolderKanban className="h-4 w-4" />
                        <span className="hidden sm:inline">Groups</span>
                    </Button>
                )}
                <Button onClick={startEditing} aria-label="Edit layout" title="Reorder, resize and hide cards" disabled={editing || devices.length === 0}>
                    <LayoutGrid className="h-4 w-4" />
                    <span className="hidden sm:inline">Layout</span>
                </Button>
                </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatTile label="Devices" value={firstLoad ? "–" : stats.total} icon={Radio} />
                <StatTile label="Online" value={firstLoad ? "–" : stats.online} icon={Wifi} tone="green" />
                <StatTile label="Offline" value={firstLoad ? "–" : stats.offline} icon={WifiOff} tone={stats.offline ? "amber" : "neutral"} />
                <StatTile label="Actuators on" value={firstLoad ? "–" : `${stats.actsOn}/${stats.actsTotal}`} icon={Power} />
            </div>

            <PendingInvites onAccepted={loadDevices} />

            {error && (
                <div role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
                    {error}
                </div>
            )}

            {/* Loading skeleton */}
            {firstLoad && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" aria-hidden>
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="h-64 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
                            <div className="h-5 w-2/3 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
                            <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
                            <div className="mt-6 grid grid-cols-2 gap-2">
                                {[0, 1, 2, 3].map((j) => <div key={j} className="h-14 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />)}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Empty state */}
            {!firstLoad && rows.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 px-6 py-14 text-center dark:border-zinc-700">
                    <Radio className="mb-3 h-10 w-10 text-zinc-300 dark:text-zinc-600" />
                    {query ? (
                        <p className="font-semibold text-zinc-900 dark:text-white">No devices match “{query}”</p>
                    ) : (
                        <>
                            <p className="font-semibold text-zinc-900 dark:text-white">No devices yet</p>
                            <p className="mt-1 max-w-sm text-sm text-zinc-500">
                                Flash your device with your user ID and it will appear here after it sends its first configuration.
                            </p>
                            <Link href="/devices" className="mt-4 inline-flex h-10 items-center rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-black">
                                How to add a device
                            </Link>
                        </>
                    )}
                </div>
            )}

            {editing && draft && (
                <div className="sticky top-16 sm:top-20 z-20 rounded-2xl border border-indigo-500/30 bg-white/95 p-3 shadow-lg backdrop-blur dark:bg-zinc-900/95">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                        <div className="min-w-0 flex-1 basis-full sm:basis-auto">
                            <div className="text-sm font-semibold text-zinc-900 dark:text-white">Editing layout</div>
                            <div className="text-xs text-zinc-500">
                                <span className="hidden md:inline">Drag cards to reorder, or use ◀ ▶.</span>
                                <span className="md:hidden">Use ◀ ▶ to reorder.</span> Pick S / M / L for size.
                            </div>
                        </div>
                        <div className="hidden lg:flex items-center gap-2">
                            <span className="text-sm text-zinc-500">Columns</span>
                            <div role="radiogroup" aria-label="Columns" className="inline-flex rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
                                {([1, 2, 3, 4] as const).map((c) => (
                                    <button
                                        key={c}
                                        type="button"
                                        role="radio"
                                        aria-checked={draft.columns === c}
                                        onClick={() => setDraft({ ...draft, columns: c })}
                                        className={cn("h-8 w-9 rounded-md text-sm font-semibold", draft.columns === c ? "bg-white shadow-sm dark:bg-zinc-950" : "text-zinc-500")}
                                    >
                                        {c}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex w-full gap-2 sm:w-auto">
                            <Button variant="ghost" onClick={() => setDraft(structuredClone(DEFAULT_LAYOUT))} title="Back to the default layout">
                                <RotateCcw className="h-4 w-4" /> <span className="hidden sm:inline">Reset</span>
                            </Button>
                            <Button className="flex-1 sm:flex-none" onClick={() => { setDraft(null); setLayoutError(""); }}>Cancel</Button>
                            <Button className="flex-1 sm:flex-none" variant="primary" onClick={finishEditing} loading={savingLayout}>Done</Button>
                        </div>
                    </div>
                    {layoutError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{layoutError}</p>}
                    {!layoutOnServer && <p className="mt-2 text-xs text-zinc-500">Saved in this browser only until your server supports dashboard layouts.</p>}
                </div>
            )}

            {/* Device sections: one per group, then everything not in a group */}
            {sections.map((sec) => (
                <section key={sec.key} aria-labelledby={`sec-${sec.key}`}>
                    {sec.group ? (
                        <button
                            type="button"
                            onClick={() => toggleCollapsed(sec.group!)}
                            aria-expanded={!sec.group.collapsed}
                            className="mb-3 flex w-full items-center gap-3 rounded-xl py-1 text-left"
                        >
                            <IconBadge icon={sec.group.icon} color={sec.group.color} fallback={FolderKanban} size="sm" />
                            <h3 id={`sec-${sec.key}`} className="min-w-0 truncate text-base font-semibold text-zinc-900 dark:text-white">{sec.group.name}</h3>
                            <span className="text-sm text-zinc-500">{sec.rows.length}</span>
                            <span className="ml-auto h-px flex-1 bg-zinc-200 dark:bg-zinc-800" aria-hidden />
                            <ChevronDown className={cn("h-4 w-4 shrink-0 text-zinc-400 transition-transform", sec.group.collapsed && "-rotate-90")} />
                        </button>
                    ) : sec.title ? (
                        <h3 id={`sec-${sec.key}`} className="mb-3 flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-white">
                            {sec.key === "shared" && <Users className="h-4 w-4 text-indigo-500" aria-hidden />}
                            {sec.title} <span className="font-normal text-zinc-500">{sec.rows.length}</span>
                        </h3>
                    ) : null}
                    {(!sec.group?.collapsed || editing) && (
                        <div className={cn("grid grid-cols-2 md:grid-cols-2 gap-3 sm:gap-4 items-start", GRID_COLS[active.columns])}>
                            {sec.rows.map((dev) => {
                                const card = active.cards[dev.id] || {};
                                const size: CardSize = card.size || "m";
                                const visibleIds = sec.rows.map((r) => r.id);
                                const index = visibleIds.indexOf(dev.id);
                                return (
                                    <div
                                        key={dev.id}
                                        className={cn(cardSpan(size, active.columns), "min-w-0", dragId === dev.id && "opacity-40")}
                                        draggable={editing}
                                        onDragStart={(e) => {
                                            setDragId(dev.id);
                                            e.dataTransfer.effectAllowed = "move";
                                            e.dataTransfer.setData("text/plain", dev.id);
                                        }}
                                        onDragEnd={() => setDragId(null)}
                                        onDragOver={(e) => {
                                            if (editing && dragId && visibleIds.includes(dragId)) e.preventDefault();
                                        }}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            if (dragId && dragId !== dev.id) moveCard(sec.key, sec.ids, dragId, sec.ids.indexOf(dev.id));
                                            setDragId(null);
                                        }}
                                    >
                                        <DeviceCard
                                            dev={dev}
                                            size={size}
                                            edit={
                                                editing
                                                    ? {
                                                          hidden: !!card.hidden,
                                                          canMoveBack: index > 0,
                                                          canMoveForward: index < visibleIds.length - 1,
                                                          onMove: (dir) => moveCard(sec.key, sec.ids, dev.id, sec.ids.indexOf(visibleIds[index + dir])),
                                                          onSize: (sz) => setCard(dev.id, { size: sz }),
                                                          onToggleHidden: () => setCard(dev.id, { hidden: !card.hidden }),
                                                      }
                                                    : undefined
                                            }
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            ))}

            {hiddenCount > 0 && (
                <p className="text-center text-sm text-zinc-500">
                    {hiddenCount} hidden card{hiddenCount > 1 ? "s" : ""} ·{" "}
                    <button type="button" onClick={startEditing} className="font-semibold text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300">Edit layout</button>
                </p>
            )}

            <GroupsModal open={managingGroups} onClose={() => setManagingGroups(false)} groups={groups} devices={devices} onChange={setGroups} />
        </div>
    );
}

/* -------- Components -------- */
function StatTile({ label, value, icon: Icon, tone = "neutral" }: { label: string; value: string | number; icon: any; tone?: "neutral" | "green" | "amber" }) {
    return (
        <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-3 sm:p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className={cn(
                "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                tone === "green" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                tone === "amber" && "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                tone === "neutral" && "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
            )}>
                <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
                <div className="text-xl font-bold leading-tight text-zinc-900 dark:text-white">{value}</div>
                <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">{label}</div>
            </div>
        </div>
    );
}

interface CardEdit {
    hidden: boolean;
    canMoveBack: boolean;
    canMoveForward: boolean;
    onMove: (dir: -1 | 1) => void;
    onSize: (size: CardSize) => void;
    onToggleHidden: () => void;
}

const SENSORS_BY_SIZE: Record<CardSize, number> = { s: 2, m: MAX_SENSORS_ON_CARD, l: 8 };

function DeviceCard({ dev, size = "m", edit }: { dev: DeviceRow; size?: CardSize; edit?: CardEdit }) {
    const pool = size === "l" ? dev.allSensors : dev.sensors;
    const shown = pool.slice(0, SENSORS_BY_SIZE[size]);
    const more = pool.length - shown.length;
    const small = size === "s";

    const body = (
        <>
            {/* Header */}
            <div className="flex items-start justify-between gap-2 sm:gap-3">
                <IconBadge icon={dev.icon} color={dev.color} fallback={Radio} size={small ? "sm" : "md"} />
                <div className="min-w-0 flex-1">
                    <h3 className={cn("truncate font-semibold text-zinc-900 dark:text-white", small ? "text-sm" : "text-base")} title={dev.name}>{dev.name}</h3>
                    {small ? (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-zinc-500">
                            <span className={cn("h-1.5 w-1.5 rounded-full", dev.online ? "bg-emerald-500" : "bg-zinc-400")} />
                            {dev.online ? "Online" : "Offline"}
                        </p>
                    ) : dev.sharedBy ? (
                        <p className="mt-0.5 truncate text-xs text-indigo-600 dark:text-indigo-400" title={`Shared by ${dev.sharedBy}`}>
                            Shared by {dev.sharedBy} · {ROLE_LABELS[dev.role]}
                        </p>
                    ) : (
                        <p className="mt-0.5 truncate font-mono text-xs text-zinc-500 dark:text-zinc-400">{dev.model} · {dev.id}</p>
                    )}
                </div>
                {!small && <StatusPill online={dev.online} />}
            </div>

            {/* Sensors */}
            {shown.length > 0 ? (
                <div className={cn("mt-3 sm:mt-4 grid gap-2", small ? "grid-cols-1" : size === "l" ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2")}>
                    {shown.map((s) => (
                        <div key={s.key} className={cn("flex min-w-0 items-center gap-2.5 rounded-xl bg-zinc-50 dark:bg-white/5", small ? "px-2.5 py-1.5" : "px-3 py-2.5")}>
                            <IconRef value={s.iconRef} fallback={s.icon} className={cn("h-4 w-4 shrink-0 text-zinc-400", s.iconRef?.startsWith("emoji:") && "text-sm", s.iconRef?.startsWith("file:") && "rounded")} />
                            <div className="min-w-0">
                                <div className="whitespace-nowrap text-sm font-semibold text-zinc-900 dark:text-white">
                                    {formatValue(s.value)}
                                    {s.unit && <span className="ml-0.5 text-xs font-normal text-zinc-500">{s.unit}</span>}
                                </div>
                                <div className="truncate text-xs text-zinc-500 dark:text-zinc-400" title={s.label}>{s.label}</div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="mt-3 rounded-xl bg-zinc-50 px-3 py-3 text-center text-sm text-zinc-500 dark:bg-white/5">No readings yet</p>
            )}
            {more > 0 && !small && <p className="mt-2 text-xs text-zinc-500">+{more} more reading{more > 1 ? "s" : ""}</p>}

            {/* Actuators */}
            {!small && dev.actuators.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                    {dev.actuators.map((a) => {
                        const on = a.state === "ON";
                        return (
                            <span
                                key={a.key}
                                className={cn(
                                    "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-medium",
                                    on
                                        ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                        : "border-zinc-200 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-transparent dark:text-zinc-400"
                                )}
                            >
                                <span className={cn("h-1.5 w-1.5 rounded-full", on ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-600")} />
                                {a.label}
                                <span className="font-semibold">{a.state}</span>
                                {a.auto && <span className="rounded bg-indigo-500/10 px-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">AUTO</span>}
                            </span>
                        );
                    })}
                </div>
            )}

            {/* Footer */}
            {!small && (
                <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                    <span>Last seen {formatLastSeen(dev.lastSeenMs)}</span>
                    {!edit && (
                        <span className="inline-flex items-center gap-0.5 font-medium text-zinc-700 group-hover:text-zinc-900 dark:text-zinc-300 dark:group-hover:text-white">
                            Open <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                        </span>
                    )}
                </div>
            )}
        </>
    );

    const cardCls = cn(
        "group flex flex-col rounded-2xl border bg-white shadow-sm dark:bg-zinc-900/40",
        small ? "p-3" : "p-4 sm:p-5",
        edit ? "border-dashed border-indigo-400/60 dark:border-indigo-500/40" : "border-zinc-200 transition hover:border-zinc-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-zinc-800 dark:hover:border-zinc-700",
        edit?.hidden && "opacity-50"
    );

    if (!edit) {
        return (
            <Link href={`/devices/${encodeURIComponent(dev.id)}`} className={cardCls}>
                {body}
            </Link>
        );
    }

    const sizes: { id: CardSize; label: string }[] = [
        { id: "s", label: "S" },
        { id: "m", label: "M" },
        { id: "l", label: "L" },
    ];
    return (
        <div className={cardCls}>
            {/* Edit controls */}
            <div className="-mx-1 -mt-1 mb-3 flex flex-wrap items-center gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
                <span className="hidden md:grid h-8 w-6 cursor-grab place-items-center text-zinc-400 active:cursor-grabbing" title="Drag to move" aria-hidden>
                    <GripVertical className="h-4 w-4" />
                </span>
                <EditBtn label={`Move ${dev.name} earlier`} onClick={() => edit.onMove(-1)} disabled={!edit.canMoveBack}><ChevronLeft className="h-4 w-4" /></EditBtn>
                <EditBtn label={`Move ${dev.name} later`} onClick={() => edit.onMove(1)} disabled={!edit.canMoveForward}><ChevronRight className="h-4 w-4" /></EditBtn>
                <div role="radiogroup" aria-label={`Size of ${dev.name}`} className="ml-auto inline-flex rounded-lg bg-white p-0.5 dark:bg-zinc-950">
                    {sizes.map((sz) => (
                        <button
                            key={sz.id}
                            type="button"
                            role="radio"
                            aria-checked={size === sz.id}
                            aria-label={{ s: "Small", m: "Medium", l: "Large" }[sz.id]}
                            onClick={() => edit.onSize(sz.id)}
                            className={cn("h-7 w-7 rounded-md text-xs font-bold", size === sz.id ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "text-zinc-500")}
                        >
                            {sz.label}
                        </button>
                    ))}
                </div>
                <EditBtn label={edit.hidden ? `Show ${dev.name}` : `Hide ${dev.name}`} onClick={edit.onToggleHidden} pressed={edit.hidden}>
                    {edit.hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </EditBtn>
            </div>
            {body}
        </div>
    );
}

function EditBtn({ label, onClick, disabled, pressed, children }: { label: string; onClick: () => void; disabled?: boolean; pressed?: boolean; children: React.ReactNode }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            aria-pressed={pressed}
            title={label}
            className="grid h-8 w-8 place-items-center rounded-md text-zinc-600 hover:bg-white disabled:opacity-30 dark:text-zinc-300 dark:hover:bg-zinc-950"
        >
            {children}
        </button>
    );
}
