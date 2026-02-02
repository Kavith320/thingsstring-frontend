"use client";

import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import {
    getLastTelemetryMs,
    isOnlineFromLastTelemetry,
    formatLastSeen,
} from "@/lib/utils";
import { getUser } from "@/lib/auth";
import { Copy, Check, Info, Plus, X, Search } from "lucide-react";
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

interface DeviceConfig {
    device?: {
        device_id?: string;
        name?: string;
        model?: string;
    };
}

interface Device {
    _id?: string;
    deviceId?: string;
    name?: string;
    config?: DeviceConfig;
    last_telemetry?: Telemetry;
}

interface DeviceRow {
    id: string;
    name: string;
    online: boolean;
    lastSeenMs: number | null;
    lastTelemetry: Telemetry | null;
}

/* -------- UI Components -------- */
function StatusBadge({ online }: { online: boolean }) {
    return (
        <span
            className={[
                "text-xs px-2 py-1 rounded-full border whitespace-nowrap",
                online
                    ? "bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400"
                    : "bg-zinc-500/10 border-zinc-500/30 text-zinc-700 dark:text-zinc-200",
            ].join(" ")}
        >
            {online ? "ONLINE" : "OFFLINE"}
        </span>
    );
}





export default function DevicesClient({
    initialDevices,
}: {
    initialDevices: Device[];
}) {
    // If not array, try to extract from property (handle various API response shapes)
    const safeInitial = Array.isArray(initialDevices)
        ? initialDevices
        : (initialDevices as any)?.devices || [];

    const [devices, setDevices] = useState<Device[]>(safeInitial);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [copied, setCopied] = useState(false);
    const [showAddDevice, setShowAddDevice] = useState(false);
    const user = getUser();
    const userId = user?.id || user?.email || "No ID";

    const handleCopy = () => {
        navigator.clipboard.writeText(userId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    async function loadDevices() {
        // Only show loading on manual refresh or initial if empty. 
        // Background polling shouldn't trigger full loading state to avoid flickering.
        // However, to keep it simple and consistent with original logic, we can keep it or refine it.
        // Let's refine: don't set loading true for background polling.
        setError("");
        try {
            const data = await apiRequest("/api/devices", { method: "GET" });
            const list = Array.isArray(data) ? data : data?.devices || [];
            setDevices(list);
        } catch (e: any) {
            console.error(e);
            // Don't show error UI for background polling failures to avoid disrupting user
        }
    }

    // Manual refresh with loading state
    async function handleRefresh() {
        setLoading(true);
        await loadDevices().catch((e: any) => setError(e.message || "Failed"));
        setLoading(false);
    }

    useEffect(() => {
        // Refresh immediately on mount to clear stale server-side data
        loadDevices();
        // Start frequent polling (3s)
        const id = setInterval(loadDevices, 3_000);
        return () => clearInterval(id);
    }, []);

    const rows = useMemo(() => {
        return (devices || []).map((d) => {
            const id = d?.deviceId || d?.config?.device?.device_id || d?._id || "-";
            const name =
                d?.config?.device?.name ||
                d?.config?.device?.model ||
                d?.name ||
                id ||
                "Unnamed device";

            const online = isOnlineFromLastTelemetry(d?.last_telemetry, 60_000);
            const lastSeenMs = getLastTelemetryMs(d?.last_telemetry);

            return {
                id,
                name,
                online,
                lastSeenMs,
                lastTelemetry: d?.last_telemetry || null,
            } as DeviceRow;
        });
    }, [devices]);





    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex items-center gap-4">
                    <div className="min-w-0">
                        <h2 className="text-xl sm:text-2xl font-semibold">Devices</h2>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                            Offline if last telemetry older than 60 seconds
                        </p>
                    </div>
                    {loading && <LoadingSignal size="sm" />}
                </div>

                <button
                    onClick={() => setShowAddDevice(!showAddDevice)}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-zinc-900 text-white px-4 py-2 text-sm hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 transition-colors shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    Add Device
                </button>
            </div>

            {showAddDevice && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto outline-none focus:outline-none">
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-300"
                        onClick={() => setShowAddDevice(false)}
                    />

                    {/* Modal CONTENT */}
                    <div className="relative w-full max-w-2xl transform overflow-hidden rounded-[2.5rem] border border-white/20 bg-white/90 p-6 sm:p-10 shadow-2xl backdrop-blur-2xl dark:border-zinc-800/50 dark:bg-zinc-950/90 transition-all animate-in fade-in zoom-in-95 duration-300">
                        {/* Close Button */}
                        <button
                            onClick={() => setShowAddDevice(false)}
                            className="absolute right-6 top-6 p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-400"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="flex flex-col sm:flex-row items-start gap-6">
                            <div className="p-4 rounded-3xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
                                <Plus className="w-8 h-8" />
                            </div>

                            <div className="flex-1 space-y-6">
                                <div>
                                    <h3 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">Provision New Device</h3>
                                    <p className="text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed">
                                        Follow these steps to connect your hardware to the ThingsString platform.
                                    </p>
                                </div>

                                <div className="grid gap-6 sm:grid-cols-2">
                                    <div className="space-y-4">
                                        <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
                                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-zinc-900 text-white text-[11px] font-mono dark:bg-white dark:text-black shadow-lg">01</span>
                                            Copy Device Secret
                                        </div>
                                        <div className="group relative flex items-center gap-2 p-4 rounded-[1.25rem] bg-zinc-100/50 border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 shadow-inner">
                                            <code className="text-xs font-mono text-zinc-600 dark:text-zinc-300 flex-1 truncate">{userId}</code>
                                            <button
                                                onClick={handleCopy}
                                                className="p-2.5 rounded-xl hover:bg-white dark:hover:bg-zinc-800 transition-all text-zinc-500 dark:text-zinc-400 shadow-sm"
                                                title="Copy User ID"
                                            >
                                                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
                                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-zinc-900 text-white text-[11px] font-mono dark:bg-white dark:text-black shadow-lg">02</span>
                                            Hotspot Connection
                                        </div>
                                        <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed px-1">
                                            Power on your device. Connect your phone or PC to the device's Wi-Fi hotspot (usually named <b>ThingsString-XXXX</b>).
                                        </p>
                                    </div>

                                    <div className="space-y-4 sm:col-span-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                                        <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
                                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-zinc-900 text-white text-[11px] font-mono dark:bg-white dark:text-black shadow-lg">03</span>
                                            Configure & Launch
                                        </div>
                                        <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed px-1">
                                            Open <b>192.168.4.1</b> in your browser. Paste your <b>User ID</b> above, enter your local Wi-Fi details, and click <b>Save</b>. The device will reboot and join your dashboard automatically.
                                        </p>
                                    </div>
                                </div>

                                <div className="pt-2">
                                    <button
                                        onClick={() => setShowAddDevice(false)}
                                        className="w-full py-4 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-black font-bold text-sm hover:opacity-90 transition-opacity"
                                    >
                                        Got it, I'm ready
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {error && (
                <div className="rounded-2xl border p-4 border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300">
                    {error}
                </div>
            )}

            {/* Empty state */}
            {!loading && !error && rows.length === 0 && (
                <div className="rounded-2xl border p-6 border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/60">
                    No devices found.
                </div>
            )}

            {/* Device cards */}
            {!error && rows.length > 0 && (
                <div className="grid gap-3">
                    {rows.map((r) => (
                        <div
                            key={r.id}
                            className="rounded-2xl border p-4 border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/60"
                        >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0">
                                    <div className="font-semibold truncate">{r.name}</div>
                                    <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 break-all">
                                        ID: {r.id}
                                        {r.lastSeenMs ? (
                                            <> • Last: {formatLastSeen(r.lastSeenMs)}</>
                                        ) : null}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between sm:justify-end gap-3">
                                    <StatusBadge online={r.online} />
                                    <a
                                        href={`/devices/${encodeURIComponent(r.id)}`}
                                        className="inline-flex items-center justify-center rounded-xl border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                                    >
                                        Open
                                    </a>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
