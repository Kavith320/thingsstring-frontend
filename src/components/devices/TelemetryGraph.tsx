"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    ResponsiveContainer,
    CartesianGrid,
    Brush,
    ReferenceArea,
    Tooltip,
} from "recharts";
import { apiRequest } from "@/lib/api";
import { Maximize2, Minimize2, RotateCcw, Clock, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

/* -------- Types -------- */
interface TelemetryPoint {
    _id?: string;
    updatedAt?: string;
    createdAt?: string;
    ts?: string;
    timestamp?: string;
    [key: string]: any;
}

interface ChartPoint extends TelemetryPoint {
    __ms: number;
}

interface TelemetryGraphProps {
    deviceId?: string;
    history?: TelemetryPoint[];
}

type TimeRange = "5m" | "1h" | "24h" | "7d" | "30d" | "all";

const TIME_RANGES: { label: string; value: TimeRange; ms: number }[] = [
    { label: "5m", value: "5m", ms: 5 * 60 * 1000 },
    { label: "1h", value: "1h", ms: 60 * 60 * 1000 },
    { label: "24h", value: "24h", ms: 24 * 60 * 60 * 1000 },
    { label: "7d", value: "7d", ms: 7 * 24 * 60 * 60 * 1000 },
    { label: "30d", value: "30d", ms: 30 * 24 * 60 * 60 * 1000 },
    { label: "All", value: "all", ms: Infinity },
];

/* -------- Mongo ObjectId -> timestamp helpers -------- */
function objectIdToMs(oid: any) {
    if (!oid || typeof oid !== "string" || oid.length < 8) return null;
    const sec = parseInt(oid.slice(0, 8), 16);
    if (!Number.isFinite(sec)) return null;
    return sec * 1000;
}

/* ---------------- chart palette ---------------- */
const CHART_COLORS = [
    "#6366f1", // indigo-500
    "#10b981", // emerald-500
    "#f59e0b", // amber-500
    "#ef4444", // red-500
    "#8b5cf6", // purple-500
    "#06b6d4", // cyan-500
    "#f97316", // orange-500
    "#ec4899", // pink-500
    "#84cc16", // lime-500
    "#14b8a6", // teal-500
];

function colorForKey(key: string, allKeys: string[]) {
    const idx = Math.max(0, allKeys.indexOf(key));
    return CHART_COLORS[idx % CHART_COLORS.length];
}

function clampDomain([a, b]: [number, number]): [number, number] | null {
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    if (a === b) return null;
    return a < b ? [a, b] : [b, a];
}

/* ---------------- dark tooltip ---------------- */
function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload || !payload.length) return null;

    return (
        <div className="rounded-2xl border border-zinc-200/80 bg-white/90 dark:border-zinc-800 dark:bg-zinc-950/90 backdrop-blur-xl px-4 py-3 text-xs shadow-2xl z-50">
            <div className="mb-2.5 text-[10px] font-mono font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800 pb-1.5">
                {label ? new Date(label).toLocaleString() : ""}
            </div>

            <div className="space-y-2 min-w-[140px]">
                {payload.map((item: any) => (
                    <div key={item.dataKey} className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ background: item.color }} />
                            <span className="truncate font-semibold text-zinc-700 dark:text-zinc-300">
                                {item.name}
                            </span>
                        </div>
                        <span className="font-mono font-extrabold text-zinc-900 dark:text-white bg-zinc-100 dark:bg-zinc-900 px-2 py-0.5 rounded-md">
                            {typeof item.value === "number" ? item.value.toFixed(2) : String(item.value)}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ---------------- main component ---------------- */
export default function TelemetryGraph({ deviceId, history = [] }: TelemetryGraphProps) {
    const [open, setOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [selectedRange, setSelectedRange] = useState<TimeRange>("24h");
    const [fetchedData, setFetchedData] = useState<TelemetryPoint[]>([]);

    // Zoom state
    const [xDomain, setXDomain] = useState<[number, number] | null>(null);
    const [refLeft, setRefLeft] = useState<string | number | null>(null);
    const [refRight, setRefRight] = useState<string | number | null>(null);

    // Selected keys
    const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
    const didInitDefaults = useRef(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Escape key listener for fullscreen modal
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && open) {
                setOpen(false);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [open]);

    // Silent seamless data fetching from backend (no screen flashing)
    const loadRangeData = useCallback(async (range: TimeRange, silent = false) => {
        if (!deviceId) return;
        try {
            const limit = range === "5m" ? 100 : range === "1h" ? 300 : range === "24h" ? 2000 : 5000;
            const res = await apiRequest(`/api/devices/${deviceId}/telemetry?limit=${limit}`);
            const list = Array.isArray(res) ? res : res?.telemetry || res?.items || [];
            
            if (silent) {
                // Seamlessly merge new datapoints into state without unmounting / flickering chart
                setFetchedData((prev) => {
                    if (prev.length === 0) return list;
                    const existingKeys = new Set(prev.map(p => p._id || p.ts || p.createdAt));
                    const freshPoints = list.filter((p: any) => !existingKeys.has(p._id || p.ts || p.createdAt));
                    if (freshPoints.length === 0) return prev;
                    return [...prev, ...freshPoints];
                });
            } else {
                setFetchedData(list);
            }
        } catch (e) {
            console.error("Failed to load telemetry data", e);
        }
    }, [deviceId]);

    useEffect(() => {
        if (deviceId) {
            loadRangeData(selectedRange, false);
            // Polling interval to silently append new points every 5 seconds
            const interval = setInterval(() => {
                loadRangeData(selectedRange, true);
            }, 5000);
            return () => clearInterval(interval);
        }
    }, [selectedRange, deviceId, loadRangeData]);

    function resetZoom() {
        setXDomain(null);
        setRefLeft(null);
        setRefRight(null);
    }

    // Determine dataset: prefer fetchedData if present, fallback to history prop
    const rawData = fetchedData.length > 0 ? fetchedData : history;

    // Filter data by selected time range
    const chartData = useMemo(() => {
        const rangeConfig = TIME_RANGES.find(r => r.value === selectedRange);
        const cutoffMs = rangeConfig && rangeConfig.ms !== Infinity ? Date.now() - rangeConfig.ms : 0;

        return (rawData || [])
            .map((h) => {
                const ms =
                    (h.updatedAt && new Date(h.updatedAt).getTime()) ||
                    (h.createdAt && new Date(h.createdAt).getTime()) ||
                    (h.ts && new Date(h.ts).getTime()) ||
                    (h.timestamp && new Date(h.timestamp).getTime()) ||
                    objectIdToMs(h._id) ||
                    null;

                return { ...h, __ms: ms } as ChartPoint;
            })
            .filter((p) => p.__ms && (cutoffMs === 0 || p.__ms >= cutoffMs))
            .sort((a, b) => a.__ms - b.__ms);
    }, [rawData, selectedRange]);

    const numericKeys = useMemo(() => {
        const ignore = new Set(["__ms", "_id", "deviceId", "id", "device", "actuators"]);
        const keys = new Set<string>();
        for (const row of chartData) {
            for (const [k, v] of Object.entries(row)) {
                if (ignore.has(k)) continue;
                if (typeof v === "number" && Number.isFinite(v)) keys.add(k);
            }
        }
        return Array.from(keys).sort();
    }, [chartData]);

    // Set defaults ONCE
    if (!didInitDefaults.current && numericKeys.length) {
        didInitDefaults.current = true;
        if (!selectedKeys.length) setSelectedKeys(numericKeys.slice(0, 3));
    }

    const safeSelectedKeys = useMemo(() => {
        if (selectedKeys.length === 0 && numericKeys.length > 0) {
            return numericKeys.slice(0, 2);
        }
        return selectedKeys;
    }, [selectedKeys, numericKeys]);

    // Multi-metric domain calculation with auto-scaling padding
    const yDomain = useMemo(() => {
        if (!chartData.length || !safeSelectedKeys.length) return ["auto", "auto"];

        let min = Infinity;
        let max = -Infinity;

        for (const row of chartData) {
            for (const key of safeSelectedKeys) {
                const v = row[key] as number;
                if (typeof v === "number" && Number.isFinite(v)) {
                    if (v < min) min = v;
                    if (v > max) max = v;
                }
            }
        }

        if (!Number.isFinite(min) || !Number.isFinite(max)) return ["auto", "auto"];
        if (min === max) return [min - 1, max + 1];

        const padding = (max - min) * 0.12;
        const lo = Math.floor((min - padding) * 100) / 100;
        const hi = Math.ceil((max + padding) * 100) / 100;
        return [lo, hi];
    }, [chartData, safeSelectedKeys]);

    // Quantized clean time ticks (00:00, 03:00, 06:00, 09:00, 12:00... or 00:00 Midnight dates)
    const quantizedTicks = useMemo(() => {
        if (!chartData.length) return [];
        const minMs = xDomain ? xDomain[0] : chartData[0].__ms;
        const maxMs = xDomain ? xDomain[1] : chartData[chartData.length - 1].__ms;

        if (!Number.isFinite(minMs) || !Number.isFinite(maxMs) || minMs >= maxMs) return [];

        const ticks: number[] = [];

        if (selectedRange === "5m") {
            const stepMs = 60 * 1000;
            let start = Math.ceil(minMs / stepMs) * stepMs;
            for (let t = start; t <= maxMs; t += stepMs) {
                ticks.push(t);
            }
        } else if (selectedRange === "1h") {
            const stepMs = 10 * 60 * 1000;
            let start = Math.ceil(minMs / stepMs) * stepMs;
            for (let t = start; t <= maxMs; t += stepMs) {
                ticks.push(t);
            }
        } else if (selectedRange === "24h") {
            const stepMs = 3 * 60 * 60 * 1000;
            const d = new Date(minMs);
            d.setMinutes(0, 0, 0);
            d.setHours(Math.floor(d.getHours() / 3) * 3);
            let t = d.getTime();
            while (t <= maxMs) {
                if (t >= minMs) ticks.push(t);
                t += stepMs;
            }
        } else {
            const d = new Date(minMs);
            d.setHours(0, 0, 0, 0);
            let t = d.getTime();
            const stepMs = selectedRange === "30d" ? 5 * 24 * 60 * 60 * 1000 : selectedRange === "7d" ? 24 * 60 * 60 * 1000 : 2 * 24 * 60 * 60 * 1000;
            while (t <= maxMs) {
                if (t >= minMs) ticks.push(t);
                t += stepMs;
            }
        }

        return ticks;
    }, [chartData, xDomain, selectedRange]);

    const dataRangeText =
        chartData.length > 0
            ? `${new Date(chartData[0].__ms).toLocaleTimeString()} → ${new Date(
                chartData[chartData.length - 1].__ms
            ).toLocaleTimeString()}`
            : "-";

    function toggleKey(k: string) {
        setSelectedKeys((prev) => {
            const has = prev.includes(k);
            if (has) return prev.filter((x) => x !== k);
            return [...prev, k];
        });
    }

    function GraphInner({ fullscreen = false }: { fullscreen?: boolean }) {
        const heightCls = fullscreen
            ? "h-[60vh] sm:h-[70vh] lg:h-[75vh]"
            : "h-[280px] sm:h-[360px] lg:h-[400px]";

        return (
            <div className="space-y-4 flex flex-col h-full">
                {/* Header Toolbar */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-100 dark:border-zinc-800/80 pb-3 shrink-0">
                    {/* Time Range Selector */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                        <span className="text-xs font-bold text-zinc-400 mr-1 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            Range:
                        </span>
                        {TIME_RANGES.map((r) => (
                            <button
                                key={r.value}
                                onClick={() => {
                                    setSelectedRange(r.value);
                                    resetZoom();
                                }}
                                className={cn(
                                    "px-2.5 py-1 text-xs font-bold rounded-xl transition-all whitespace-nowrap",
                                    selectedRange === r.value
                                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800/80 dark:text-zinc-400 dark:hover:bg-zinc-700"
                                )}
                            >
                                {r.label}
                            </button>
                        ))}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between sm:justify-end gap-2">
                        <div className="text-[11px] font-mono text-zinc-400 flex items-center gap-1.5">
                            <span className="flex h-2 w-2 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <span>{chartData.length} pts</span>
                        </div>

                        <button
                            onClick={resetZoom}
                            className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition flex items-center gap-1 text-xs font-bold"
                            title="Reset Zoom"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Reset</span>
                        </button>

                        {!fullscreen ? (
                            <button
                                onClick={() => setOpen(true)}
                                className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition flex items-center gap-1 text-xs font-bold"
                            >
                                <Maximize2 className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Fullscreen</span>
                            </button>
                        ) : (
                            <button
                                onClick={() => setOpen(false)}
                                className="p-2 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-black font-bold text-xs transition flex items-center gap-1 shadow-lg"
                            >
                                <Minimize2 className="w-3.5 h-3.5" />
                                Exit Fullscreen
                            </button>
                        )}
                    </div>
                </div>

                {/* Metric Field Chips */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 shrink-0">
                    <span className="text-xs font-bold text-zinc-400 shrink-0 flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5" />
                        Metrics:
                    </span>
                    {numericKeys.map((k) => {
                        const checked = safeSelectedKeys.includes(k);
                        const stroke = colorForKey(k, numericKeys);

                        return (
                            <button
                                key={k}
                                onClick={() => toggleKey(k)}
                                className={cn(
                                    "text-xs px-3 py-1 rounded-full border flex items-center gap-2 transition font-bold whitespace-nowrap shrink-0",
                                    checked
                                        ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-black shadow-sm"
                                        : "border-zinc-200 bg-white text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700"
                                )}
                            >
                                <span className="inline-block h-2.5 w-2.5 rounded-full shadow-sm" style={{ background: stroke }} />
                                {k}
                            </button>
                        );
                    })}

                    {safeSelectedKeys.length > 0 && (
                        <button
                            onClick={() => setSelectedKeys(numericKeys.slice(0, 2))}
                            className="text-xs px-2 py-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition font-bold shrink-0"
                        >
                            Reset
                        </button>
                    )}
                </div>

                {/* Chart Viewport */}
                <div className="flex-1 rounded-3xl border p-2 sm:p-4 border-zinc-100 bg-zinc-50/50 dark:border-zinc-800/50 dark:bg-zinc-900/20 backdrop-blur-sm flex flex-col min-h-0">
                    <div className={`w-full ${heightCls}`}>
                        {mounted ? (
                            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                <AreaChart
                                    data={chartData}
                                    onMouseDown={(e: any) => {
                                        if (!e || e.activeLabel == null) return;
                                        setRefLeft(e.activeLabel);
                                        setRefRight(null);
                                    }}
                                    onMouseMove={(e: any) => {
                                        if (refLeft == null) return;
                                        if (!e || e.activeLabel == null) return;
                                        setRefRight(e.activeLabel);
                                    }}
                                    onMouseUp={() => {
                                        if (refLeft == null || refRight == null) {
                                            setRefLeft(null);
                                            setRefRight(null);
                                            return;
                                        }
                                        const next = clampDomain([refLeft as number, refRight as number]);
                                        if (next) setXDomain(next);
                                        setRefLeft(null);
                                        setRefRight(null);
                                    }}
                                >
                                    <defs>
                                        {safeSelectedKeys.map((k) => (
                                            <linearGradient key={k} id={`color-${k}`} x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={colorForKey(k, numericKeys)} stopOpacity={0.35} />
                                                <stop offset="95%" stopColor={colorForKey(k, numericKeys)} stopOpacity={0} />
                                            </linearGradient>
                                        ))}
                                    </defs>

                                    <CartesianGrid strokeDasharray="3 3" stroke="#71717a" strokeOpacity={0.2} vertical={true} />

                                    <XAxis
                                        dataKey="__ms"
                                        type="number"
                                        domain={xDomain || ["dataMin", "dataMax"]}
                                        ticks={quantizedTicks.length > 0 ? quantizedTicks : undefined}
                                        tickFormatter={(ms) => {
                                            const d = new Date(ms);
                                            return selectedRange === "7d" || selectedRange === "30d" || selectedRange === "all"
                                                ? `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}`
                                                : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                        }}
                                        stroke="#a1a1aa"
                                        fontSize={10}
                                        tickLine={{ stroke: "#a1a1aa", strokeOpacity: 0.3 }}
                                        axisLine={false}
                                        minTickGap={fullscreen ? 40 : 30}
                                    />

                                    <YAxis
                                        domain={yDomain as any}
                                        stroke="#a1a1aa"
                                        fontSize={11}
                                        tickLine={false}
                                        axisLine={false}
                                        tickCount={5}
                                    />

                                    <Tooltip
                                        content={<CustomTooltip />}
                                        cursor={{ stroke: "#a1a1aa", strokeWidth: 1, strokeDasharray: "4 4" }}
                                    />

                                    {refLeft != null && refRight != null ? (
                                        <ReferenceArea x1={refLeft} x2={refRight} strokeOpacity={0.1} fillOpacity={0.1} />
                                    ) : null}

                                    {safeSelectedKeys.map((k) => (
                                        <Area
                                            key={k}
                                            type="monotone"
                                            dataKey={k}
                                            stroke={colorForKey(k, numericKeys)}
                                            fill={`url(#color-${k})`}
                                            strokeWidth={2.5}
                                            isAnimationActive={false} // Prevents chart flash on live point appends
                                            activeDot={{ r: 6, strokeWidth: 0, fill: colorForKey(k, numericKeys) }}
                                        />
                                    ))}

                                    <Brush
                                        dataKey="__ms"
                                        height={20}
                                        travellerWidth={10}
                                        tickFormatter={() => ""}
                                        stroke="#52525b"
                                        fill="transparent"
                                        onChange={(range: any) => {
                                            if (!range) return;
                                            const start = chartData?.[range.startIndex]?.__ms;
                                            const end = chartData?.[range.endIndex]?.__ms;
                                            if (start && end) {
                                                const next = clampDomain([start, end]);
                                                setXDomain(next);
                                            }
                                        }}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-zinc-400">
                                Loading telemetry chart...
                            </div>
                        )}
                    </div>

                    <div className="mt-3 flex items-center justify-between text-[10px] text-zinc-400 font-mono px-2 shrink-0">
                        <span>Range: {dataRangeText}</span>
                        <span>Drag on graph to zoom in</span>
                    </div>
                </div>
            </div>
        );
    }

    if (!chartData.length) {
        return (
            <div className="p-8 text-center rounded-3xl border border-dashed border-zinc-300 dark:border-zinc-800 space-y-3">
                <div className="flex items-center justify-center gap-1.5">
                    {TIME_RANGES.map((r) => (
                        <button
                            key={r.value}
                            onClick={() => {
                                setSelectedRange(r.value);
                                resetZoom();
                            }}
                            className={cn(
                                "px-2.5 py-1 text-xs font-bold rounded-xl transition-all",
                                selectedRange === r.value
                                    ? "bg-indigo-600 text-white shadow-md font-bold"
                                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                            )}
                        >
                            {r.label}
                        </button>
                    ))}
                </div>
                <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">No telemetry recorded for this time range</div>
                <div className="text-xs text-zinc-400">Try selecting a broader time range above</div>
            </div>
        );
    }

    return (
        <>
            <GraphInner fullscreen={false} />

            {/* Fullscreen Portal - Mounts to document.body so it breaks out of parent container frames */}
            {open && mounted && createPortal(
                <div
                    className="fixed inset-0 z-[99999] bg-zinc-950/90 backdrop-blur-2xl p-3 sm:p-6 flex items-center justify-center animate-in fade-in duration-200"
                    onClick={() => setOpen(false)}
                >
                    <div
                        className="w-full max-w-7xl h-[92vh] rounded-[2.5rem] border border-white/15 bg-zinc-900/95 backdrop-blur-2xl shadow-2xl overflow-hidden ring-1 ring-white/10 p-4 sm:p-8 flex flex-col animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <GraphInner fullscreen />
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
