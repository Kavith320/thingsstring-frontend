"use client";

import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import {
    getLastTelemetryMs,
    isOnlineFromLastTelemetry,
    formatLastSeen,
} from "@/lib/utils";

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
        // Start polling
        const id = setInterval(loadDevices, 10_000);
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
                <div className="min-w-0">
                    <h2 className="text-xl sm:text-2xl font-semibold">Devices</h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        Offline if last telemetry older than 60 seconds
                    </p>
                </div>

                <button
                    onClick={handleRefresh}
                    disabled={loading}
                    className="w-full sm:w-auto rounded-xl border px-3 py-2 text-sm border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800 disabled:opacity-50"
                >
                    {loading ? "Refreshing..." : "Refresh"}
                </button>
            </div>

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
