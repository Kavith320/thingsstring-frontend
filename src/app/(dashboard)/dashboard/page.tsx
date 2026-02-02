"use client";

import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
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
    ToggleLeft,
    ToggleRight,
    CircleDot,
    Search
} from "lucide-react";
import { cn } from "@/lib/utils";
import LoadingSignal from "@/components/LoadingSignal";

/* -------- Types -------- */
interface Telemetry {
    _id?: string;
    updatedAt?: string;
    createdAt?: string;
    ts?: string;
    timestamp?: string;
    [key: string]: any;
}

interface Device {
    _id: string;
    deviceId?: string;
    name?: string;
    last_telemetry?: Telemetry;
    config?: {
        device?: {
            name?: string;
            model?: string;
            device_id?: string;
        };
        actuators?: any;
    };
    actuators?: any;
}

interface DeviceRow {
    id: string;
    name: string;
    model: string;
    online: boolean;
    lastSeenMs: number | null;
    sensors: { key: string; value: any; unit?: string; icon: any }[];
    actuators: { key: string; state: string }[];
}

/* -------- Helpers -------- */

function objectIdToMs(oid: any) {
    if (!oid || typeof oid !== "string" || oid.length < 8) return null;
    const sec = parseInt(oid.slice(0, 8), 16);
    if (!Number.isFinite(sec)) return null;
    return sec * 1000;
}

function getLastTelemetryMs(lastTelemetry?: Telemetry) {
    if (!lastTelemetry) return null;
    const t = lastTelemetry.updatedAt || lastTelemetry.createdAt || lastTelemetry.ts || lastTelemetry.timestamp || null;
    if (t) {
        const ms = new Date(t).getTime();
        if (Number.isFinite(ms)) return ms;
    }
    return objectIdToMs(lastTelemetry._id);
}

function isOnlineFromLastTelemetry(lastTelemetry?: Telemetry, maxAgeMs = 60_000) {
    const ms = getLastTelemetryMs(lastTelemetry);
    if (!ms) return false;
    return Date.now() - ms <= maxAgeMs;
}

function formatLastSeen(ms: number | null) {
    if (!ms) return "No data";
    const secAgo = Math.floor((Date.now() - ms) / 1000);
    if (secAgo < 60) return "Just now";
    if (secAgo < 3600) return `${Math.floor(secAgo / 60)}m ago`;
    if (secAgo < 86400) return `${Math.floor(secAgo / 3600)}h ago`;
    return new Date(ms).toLocaleDateString();
}

/**
 * Heuristic to pick an icon based on sensor key
 */
function getIconForKey(key: string) {
    const k = key.toLowerCase();
    if (k.includes("temp")) return Thermometer;
    if (k.includes("hum")) return Droplets;
    if (k.includes("vol") || k.includes("batt")) return Battery;
    if (k.includes("cur") || k.includes("pwr") || k.includes("watt")) return Zap;
    if (k.includes("cpu") || k.includes("mem")) return Cpu;
    if (k.includes("sig") || k.includes("rssi")) return Wifi;
    if (k.includes("press")) return Gauge;
    if (k.includes("wind")) return Wind;
    if (k.includes("light") || k.includes("lux")) return Sun;
    return Activity; // Default
}

/**
 * Heuristic to guess unit
 */
function getUnitForKey(key: string) {
    const k = key.toLowerCase();
    if (k.includes("temp")) return "°C";
    if (k.includes("hum")) return "%";
    if (k.includes("batt")) return "%";
    if (k.includes("vol")) return "V";
    if (k.includes("cur")) return "A";
    if (k.includes("pres")) return "hPa";
    if (k.includes("lux")) return "lx";
    return "";
}

export default function DashboardPage() {
    const [devices, setDevices] = useState<Device[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [query, setQuery] = useState("");

    async function loadDevices() {
        setError("");
        try {
            const data: any = await apiRequest("/api/devices", { method: "GET" });
            const list = Array.isArray(data) ? data : data?.devices || [];
            setDevices(list);
        } catch (e: any) {
            setError(e.message || "Failed to load devices");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        setLoading(true);
        loadDevices();
        const id = setInterval(loadDevices, 5000); // Fast 5s polling for "Realtime" feel
        return () => clearInterval(id);
    }, []);

    const rows = useMemo(() => {
        const mapped: DeviceRow[] = (devices || []).map((d) => {
            const id = d?.deviceId || d?.config?.device?.device_id || d?._id || "-";
            const name = d?.config?.device?.name || d?.name || id || "Device";
            const model = d?.config?.device?.model || "Generic";

            const online = isOnlineFromLastTelemetry(d?.last_telemetry, 60_000);
            const lastSeenMs = getLastTelemetryMs(d?.last_telemetry);

            // Parse Sensors
            const last = d?.last_telemetry || {};
            const sensors: any[] = [];

            Object.entries(last).forEach(([k, v]) => {
                // Skip non-data fields
                if (['ts', 'timestamp', 'created_at', 'updatedAt', '_id', '__v', 'actuators'].includes(k)) return;

                // If it's a number, it's likely a sensor
                if (typeof v === 'number') {
                    sensors.push({
                        key: k,
                        value: v,
                        unit: getUnitForKey(k),
                        icon: getIconForKey(k)
                    });
                }
            });

            // Parse Actuators (Check both top-level config/actuators and telemetry/actuators)
            const actuators: any[] = [];
            // Merge config actuators and telemetry actuators
            const configActs = d.config?.actuators || d.actuators || {};
            const telemActs = last.actuators || {};

            // Combine keys unique
            const allActKeys = new Set([...Object.keys(configActs), ...Object.keys(telemActs)]);

            allActKeys.forEach(key => {
                // Try to find state in telemetry first, then config, then default
                let val = telemActs[key];
                if (val === undefined) {
                    // Try to find in config
                    const c = configActs[key];
                    val = (typeof c === 'object') ? (c.value || c.state) : c;
                }

                // Normalize state
                let state = "OFF";
                if (val === 1 || val === true || val === "ON" || val === "high") state = "ON";

                actuators.push({ key, state });
            });

            return { id, name, model, online, lastSeenMs, sensors, actuators };
        });

        const q = query.trim().toLowerCase();
        if (!q) return mapped;

        return mapped.filter(
            (r) =>
                r.name.toLowerCase().includes(q) || String(r.id).toLowerCase().includes(q)
        );
    }, [devices, query]);

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white tracking-tight">System Overview</h2>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Real-time status of your IoT fleet</p>
                    </div>
                    {loading && <LoadingSignal size="sm" className="hidden sm:flex" />}
                </div>

                <div className="relative group w-full sm:w-auto">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-zinc-600 dark:group-focus-within:text-zinc-200 transition-colors" />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search fleet..."
                        className="pl-9 pr-4 py-2.5 rounded-2xl border border-zinc-200 bg-white/50 backdrop-blur-sm text-sm outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-white dark:focus:ring-white/10 w-full sm:w-64 transition-all shadow-sm"
                    />
                </div>
            </div>

            {/* Error State */}
            {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-400 animate-in fade-in zoom-in-95 duration-200">
                    {error}
                </div>
            )}

            {/* Loading Overlay */}
            {loading && !devices.length && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-50/10 dark:bg-zinc-950/10 backdrop-blur-md">
                    <LoadingSignal size="lg" />
                </div>
            )}

            {/* Empty State */}
            {!loading && rows.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/20">
                    <CircleDot className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mb-4" />
                    <p className="text-zinc-900 dark:text-white font-bold text-lg">No devices found</p>
                    <p className="text-zinc-500 text-sm mt-1 max-w-xs mx-auto">Waiting for your first telemetry packet to arrive...</p>
                </div>
            )}

            {/* Device Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                {rows.map((dev) => (
                    <a
                        key={dev.id}
                        href={`/devices/${encodeURIComponent(dev.id)}`}
                        className="
                            group relative flex flex-col overflow-hidden
                            rounded-3xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950/40
                            p-6 shadow-sm transition-all duration-300
                            hover:shadow-xl hover:shadow-zinc-200/50 dark:hover:shadow-black/50
                            hover:-translate-y-1
                            backdrop-blur-xl
                        "
                    >
                        {/* Header Row */}
                        <div className="flex items-start justify-between mb-6">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white truncate">
                                        {dev.name}
                                    </h3>
                                </div>
                                <p className="text-xs font-mono text-zinc-400 uppercase tracking-wider mt-1 truncate">
                                    {dev.model} • {dev.id}
                                </p>
                            </div>

                            {/* Visual Status Indicator */}
                            <div className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wide border shadow-sm",
                                dev.online
                                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                                    : "bg-zinc-100 border-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400"
                            )}>
                                <span className={cn(
                                    "w-1.5 h-1.5 rounded-full",
                                    dev.online ? "bg-emerald-500 animate-pulse" : "bg-zinc-400"
                                )} />
                                {dev.online ? "ONLINE" : "OFFLINE"}
                            </div>
                        </div>

                        {/* Middle: Data Grid */}
                        <div className="flex-1 grid grid-cols-2 gap-3 mb-6">
                            {/* Sensors */}
                            {dev.sensors.length > 0 ? (
                                dev.sensors.map((sensor, idx) => {
                                    const Icon = sensor.icon;
                                    return (
                                        <div key={idx} className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-50 border border-zinc-100 dark:bg-white/5 dark:border-white/5">
                                            <div className="w-8 h-8 rounded-full bg-white dark:bg-white/10 flex items-center justify-center text-zinc-500 dark:text-zinc-300 shadow-sm">
                                                <Icon className="w-4 h-4" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-sm font-bold text-zinc-900 dark:text-white truncate">
                                                    {typeof sensor.value === 'number' ? sensor.value.toFixed(1) : sensor.value}
                                                    <span className="text-xs text-zinc-400 font-normal ml-0.5">{sensor.unit}</span>
                                                </div>
                                                <div className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wide truncate">
                                                    {sensor.key}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="col-span-2 py-4 text-center text-xs text-zinc-400 italic">
                                    No sensor data received
                                </div>
                            )}
                        </div>

                        {/* Actuators Row (if any) */}
                        {dev.actuators.length > 0 && (
                            <div className="mb-6 pt-4 border-t border-zinc-100 dark:border-zinc-800/50">
                                <p className="text-[10px] uppercase tracking-widest text-zinc-400 mb-3 font-semibold">Actuators</p>
                                <div className="flex flex-wrap gap-2">
                                    {dev.actuators.map((act, idx) => {
                                        const isOn = act.state === "ON";
                                        return (
                                            <div key={idx} className={cn(
                                                "flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl border text-xs font-medium transition-colors cursor-default select-none",
                                                isOn
                                                    ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300"
                                                    : "bg-zinc-50 border-zinc-200 text-zinc-500 dark:bg-zinc-900 dark:border-zinc-800"
                                            )}>
                                                {isOn ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                                                <span>{act.key}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Footer */}
                        <div className="mt-auto pt-4 border-t border-zinc-100 dark:border-zinc-800/50 flex justify-between items-center text-xs text-zinc-400">
                            <span>Last seen {formatLastSeen(dev.lastSeenMs)}</span>
                            <span className="group-hover:translate-x-1 transition-transform text-zinc-300 dark:text-zinc-600">Details →</span>
                        </div>
                    </a>
                ))}
            </div>
        </div>
    );
}
