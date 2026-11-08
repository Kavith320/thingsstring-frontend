"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { apiRequest } from "@/lib/api";
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
    WifiOff,
} from "lucide-react";
import {
    cn,
    formatLastSeen,
    getLastTelemetryMs,
    humanizeKey,
    isActuatorAuto,
    isOnlineFromLastTelemetry,
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
}

interface Sensor { key: string; label: string; value: number; unit: string; icon: any }
interface Actuator { key: string; label: string; state: "ON" | "OFF"; auto: boolean }
interface DeviceRow {
    id: string;
    name: string;
    model: string;
    online: boolean;
    lastSeenMs: number | null;
    sensors: Sensor[];
    actuators: Actuator[];
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

function toRow(d: Device): DeviceRow {
    const id = d?.deviceId || d?.config?.device?.device_id || d?._id || "-";
    const last = d?.last_telemetry || {};

    const sensors: Sensor[] = Object.entries(last)
        .filter(([k, v]) => !NON_SENSOR_KEYS.has(k) && typeof v === "number" && Number.isFinite(v))
        .map(([k, v]) => ({ key: k, label: humanizeKey(k), value: v as number, unit: getUnitForKey(k), icon: getIconForKey(k) }));

    // Desired state + mode come from device_control (what the backend acts on); the
    // device's own report in telemetry wins for the live ON/OFF when present.
    const control = d?.control?.actuators || {};
    const config = d?.config?.actuators || {};
    const reported = (last as any).actuators || {};
    const keys = new Set([...Object.keys(control), ...Object.keys(config), ...Object.keys(reported)]);
    const actuators: Actuator[] = [...keys].map((key) => {
        const ctl = control[key] ?? config[key];
        const live = reported[key] ?? ctl?.state ?? ctl?.status ?? ctl?.value ?? ctl?.default?.state;
        return { key, label: humanizeKey(key), state: toOnOff(live), auto: isActuatorAuto(ctl) };
    });

    return {
        id,
        name: d?.config?.device?.name || d?.name || id,
        model: d?.config?.device?.model || "Device",
        online: isOnlineFromLastTelemetry(last),
        lastSeenMs: getLastTelemetryMs(last),
        sensors,
        actuators,
    };
}

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

    const allRows = useMemo(() => devices.map(toRow), [devices]);

    const rows = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return allRows;
        return allRows.filter((r) => r.name.toLowerCase().includes(q) || String(r.id).toLowerCase().includes(q));
    }, [allRows, query]);

    const stats = useMemo(() => {
        const online = allRows.filter((r) => r.online).length;
        const acts = allRows.flatMap((r) => r.actuators);
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
                <label className="relative w-full sm:w-72">
                    <span className="sr-only">Search devices</span>
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search devices…"
                        className="h-11 w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/5 dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-zinc-600"
                    />
                </label>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatTile label="Devices" value={firstLoad ? "–" : stats.total} icon={Radio} />
                <StatTile label="Online" value={firstLoad ? "–" : stats.online} icon={Wifi} tone="green" />
                <StatTile label="Offline" value={firstLoad ? "–" : stats.offline} icon={WifiOff} tone={stats.offline ? "amber" : "neutral"} />
                <StatTile label="Actuators on" value={firstLoad ? "–" : `${stats.actsOn}/${stats.actsTotal}`} icon={Power} />
            </div>

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

            {/* Device grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
                {rows.map((dev) => (
                    <DeviceCard key={dev.id} dev={dev} />
                ))}
            </div>
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

function DeviceCard({ dev }: { dev: DeviceRow }) {
    const shown = dev.sensors.slice(0, MAX_SENSORS_ON_CARD);
    const hidden = dev.sensors.length - shown.length;

    return (
        <Link
            href={`/devices/${encodeURIComponent(dev.id)}`}
            className="group flex flex-col rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 shadow-sm transition hover:border-zinc-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:border-zinc-700"
        >
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-zinc-900 dark:text-white" title={dev.name}>{dev.name}</h3>
                    <p className="mt-0.5 truncate font-mono text-xs text-zinc-500 dark:text-zinc-400">{dev.model} · {dev.id}</p>
                </div>
                <StatusPill online={dev.online} />
            </div>

            {/* Sensors */}
            {shown.length > 0 ? (
                <div className="mt-4 grid grid-cols-2 gap-2">
                    {shown.map((s) => {
                        const Icon = s.icon;
                        return (
                            <div key={s.key} className="flex min-w-0 items-center gap-2.5 rounded-xl bg-zinc-50 px-3 py-2.5 dark:bg-white/5">
                                <Icon className="h-4 w-4 shrink-0 text-zinc-400" />
                                <div className="min-w-0">
                                    <div className="whitespace-nowrap text-sm font-semibold text-zinc-900 dark:text-white">
                                        {formatValue(s.value)}
                                        {s.unit && <span className="ml-0.5 text-xs font-normal text-zinc-500">{s.unit}</span>}
                                    </div>
                                    <div className="truncate text-xs text-zinc-500 dark:text-zinc-400" title={s.label}>{s.label}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <p className="mt-4 rounded-xl bg-zinc-50 px-3 py-4 text-center text-sm text-zinc-500 dark:bg-white/5">No sensor readings yet</p>
            )}
            {hidden > 0 && <p className="mt-2 text-xs text-zinc-500">+{hidden} more reading{hidden > 1 ? "s" : ""}</p>}

            {/* Actuators */}
            {dev.actuators.length > 0 && (
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
            <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                <span>Last seen {formatLastSeen(dev.lastSeenMs)}</span>
                <span className="inline-flex items-center gap-0.5 font-medium text-zinc-700 group-hover:text-zinc-900 dark:text-zinc-300 dark:group-hover:text-white">
                    Open <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
            </div>
        </Link>
    );
}
