"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
    history?: TelemetryPoint[];
}

/* -------- Mongo ObjectId -> timestamp helpers -------- */
function objectIdToMs(oid: any) {
    if (!oid || typeof oid !== "string" || oid.length < 8) return null;
    const sec = parseInt(oid.slice(0, 8), 16);
    if (!Number.isFinite(sec)) return null;
    return sec * 1000;
}

/* ---------------- chart palette ---------------- */
const CHART_COLORS = [
    "#22c55e", // green-500
    "#3b82f6", // blue-500
    "#f59e0b", // amber-500
    "#ef4444", // red-500
    "#a855f7", // purple-500
    "#06b6d4", // cyan-500
    "#f97316", // orange-500
    "#84cc16", // lime-500
    "#e11d48", // rose-600
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

/* ---------------- dark tooltip (fixes white box) ---------------- */
function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload || !payload.length) return null;

    return (
        <div className="rounded-xl border border-zinc-200/50 bg-white/60 dark:border-zinc-700/50 dark:bg-zinc-950/60 backdrop-blur-xl px-4 py-3 text-xs shadow-xl">
            <div className="mb-2 text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
                {label ? new Date(label).toLocaleString() : ""}
            </div>

            <div className="space-y-1.5">
                {payload.map((item: any) => (
                    <div key={item.dataKey} className="flex items-center justify-between gap-6">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ background: item.color }} />
                            <span className="truncate font-medium text-zinc-700 dark:text-zinc-300">
                                {item.name}
                            </span>
                        </div>
                        <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                            {typeof item.value === "number" ? item.value.toFixed(2) : String(item.value)}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ---------------- main component ---------------- */
export default function TelemetryGraph({ history = [] }: TelemetryGraphProps) {
    const [open, setOpen] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Zoom state
    const [xDomain, setXDomain] = useState<[number, number] | null>(null);
    const [refLeft, setRefLeft] = useState<string | number | null>(null);
    const [refRight, setRefRight] = useState<string | number | null>(null);

    // Selected keys (default will be chosen without useEffect)
    const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

    // Prevent re-initializing defaults repeatedly
    const didInitDefaults = useRef(false);

    function resetZoom() {
        setXDomain(null);
        setRefLeft(null);
        setRefRight(null);
    }

    // Normalize to chart points (last 24h) WITHOUT Date.now() in render loop
    const nowRef = useRef(Date.now()); // stable now until refresh/page reload

    const chartData = useMemo(() => {
        const fromMs = nowRef.current - 24 * 60 * 60 * 1000;

        return (history || [])
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
            .filter((p) => p.__ms && p.__ms >= fromMs)
            .sort((a, b) => a.__ms - b.__ms);
    }, [history]);

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
        if (!selectedKeys.length) setSelectedKeys(numericKeys.slice(0, 2));
    }

    // Mobile-friendly: keep max 2 lines for readability
    const mobileMax = 2;
    const safeSelectedKeys = useMemo(() => {
        // if user selected too many, clamp for mobile usability
        if (selectedKeys.length <= 4) return selectedKeys;
        return selectedKeys.slice(0, 4);
    }, [selectedKeys]);

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

        const padding = (max - min) * 0.1; // slightly more padding for area chart
        const lo = Math.floor((min - padding) * 100) / 100;
        const hi = Math.ceil((max + padding) * 100) / 100;
        return [lo, hi];
    }, [chartData, safeSelectedKeys]);

    const dataRangeText =
        chartData.length > 0
            ? `${new Date(chartData[0].__ms).toLocaleString()} → ${new Date(
                chartData[chartData.length - 1].__ms
            ).toLocaleString()}`
            : "-";

    function toggleKey(k: string) {
        setSelectedKeys((prev) => {
            const has = prev.includes(k);
            if (has) return prev.filter((x) => x !== k);

            // allow up to 4 (desktop). for mobile readability we still show fine.
            if (prev.length >= 4) return prev;
            return [...prev, k];
        });
    }

    function GraphInner({ fullscreen = false }: { fullscreen?: boolean }) {
        const heightCls = fullscreen
            ? "h-[72vh] sm:h-[76vh] lg:h-[80vh]"
            : "h-[260px] sm:h-[320px] lg:h-[380px]";

        const maxChip = 4;

        const showKeys =
            fullscreen
                ? safeSelectedKeys
                : safeSelectedKeys.length > mobileMax
                    ? safeSelectedKeys.slice(0, mobileMax)
                    : safeSelectedKeys;

        return (
            <div className="space-y-4">
                {/* controls */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        Select fields (max {maxChip}):
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <div className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                            {chartData.length} pts
                        </div>

                        <button
                            onClick={resetZoom}
                            className="rounded-lg border px-3 py-1.5 text-xs font-medium border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900 transition"
                        >
                            Reset Zoom
                        </button>

                        {!fullscreen && (
                            <button
                                onClick={() => setOpen(true)}
                                className="rounded-lg border px-3 py-1.5 text-xs font-medium border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900 transition"
                            >
                                Fullscreen
                            </button>
                        )}

                        {fullscreen && (
                            <button
                                onClick={() => setOpen(false)}
                                className="rounded-lg bg-zinc-900 text-white px-3 py-1.5 text-xs font-medium dark:bg-zinc-100 dark:text-black transition"
                            >
                                Close
                            </button>
                        )}
                    </div>
                </div>

                {/* chips */}
                <div className="flex flex-wrap items-center gap-2">
                    {numericKeys.map((k) => {
                        const checked = safeSelectedKeys.includes(k);
                        const stroke = colorForKey(k, numericKeys);

                        return (
                            <button
                                key={k}
                                onClick={() => toggleKey(k)}
                                className={[
                                    "text-xs px-3 py-1.5 rounded-full border flex items-center gap-2 transition font-medium",
                                    checked
                                        ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-black shadow-sm"
                                        : "border-zinc-200 bg-white text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700",
                                ].join(" ")}
                            >
                                <span className="inline-block h-2 w-2 rounded-full ring-2 ring-inset ring-black/10 dark:ring-white/10" style={{ background: stroke }} />
                                {checked ? "" : ""}
                                {k}
                            </button>
                        );
                    })}

                    {safeSelectedKeys.length > 0 && (
                        <button
                            onClick={() => setSelectedKeys(numericKeys.slice(0, 2))}
                            className="text-xs px-2 py-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition"
                        >
                            Reset
                        </button>
                    )}
                </div>

                {/* chart */}
                <div className="rounded-3xl border p-1 sm:p-4 border-zinc-100 bg-zinc-50/50 dark:border-zinc-800/50 dark:bg-zinc-900/20 backdrop-blur-sm">
                    <div className={`w-full ${heightCls}`}>
                        {mounted ? (
                            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                <AreaChart
                                    data={chartData}
                                    onMouseDown={(e: any) => {
                                        if (!fullscreen) return;
                                        if (!e || e.activeLabel == null) return;
                                        setRefLeft(e.activeLabel);
                                        setRefRight(null);
                                    }}
                                    onMouseMove={(e: any) => {
                                        if (!fullscreen) return;
                                        if (refLeft == null) return;
                                        if (!e || e.activeLabel == null) return;
                                        setRefRight(e.activeLabel);
                                    }}
                                    onMouseUp={() => {
                                        if (!fullscreen) return;
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
                                        {(fullscreen ? safeSelectedKeys : showKeys).map((k) => (
                                            <linearGradient key={k} id={`color-${k}`} x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={colorForKey(k, numericKeys)} stopOpacity={0.3} />
                                                <stop offset="95%" stopColor={colorForKey(k, numericKeys)} stopOpacity={0} />
                                            </linearGradient>
                                        ))}
                                    </defs>

                                    <CartesianGrid strokeDasharray="3 3" stroke="#52525b" strokeOpacity={0.1} vertical={false} />

                                    <XAxis
                                        dataKey="__ms"
                                        type="number"
                                        domain={xDomain || ["dataMin", "dataMax"]}
                                        tickFormatter={(ms) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        stroke="#a1a1aa"
                                        fontSize={11}
                                        tickLine={false}
                                        axisLine={false}
                                        minTickGap={30}
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

                                    {(fullscreen ? safeSelectedKeys : showKeys).map((k) => (
                                        <Area
                                            key={k}
                                            type="monotone"
                                            dataKey={k}
                                            stroke={colorForKey(k, numericKeys)}
                                            fill={`url(#color-${k})`}
                                            strokeWidth={2}
                                            isAnimationActive={fullscreen} // smoother only in fullscreen
                                            animationDuration={500}
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
                                Loading chart...
                            </div>
                        )}
                    </div>

                    <div className="mt-3 flex items-center justify-between text-[10px] text-zinc-400 px-2">
                        <span>Data range: {dataRangeText}</span>
                        <span>{fullscreen ? "Drag to zoom" : "Use Fullscreen to zoom"}</span>
                    </div>
                </div>
            </div>
        );
    }

    if (!chartData.length) {
        return (
            <div className="p-8 text-center rounded-3xl border border-dashed border-zinc-300 dark:border-zinc-800">
                <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Waiting for telemetry...</div>
                <div className="text-xs text-zinc-400 mt-1">Data from the last 24h will appear here</div>
            </div>
        );
    }

    if (!numericKeys.length) {
        return (
            <div className="p-8 text-center rounded-3xl border border-dashed border-zinc-300 dark:border-zinc-800">
                <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">No numeric data found</div>
                <div className="text-xs text-zinc-400 mt-1">This device hasn't sent any number values yet.</div>
            </div>
        );
    }

    return (
        <>
            <GraphInner fullscreen={false} />

            {/* Fullscreen Modal */}
            {open && (
                <div className="fixed inset-0 z-[100] bg-zinc-950/60 backdrop-blur-md p-2 sm:p-6 flex items-center justify-center animate-in fade-in duration-200">
                    <div className="w-full max-w-6xl rounded-[2rem] border border-white/10 bg-zinc-900/90 backdrop-blur-2xl shadow-2xl overflow-hidden ring-1 ring-white/10">
                        <div className="p-6">
                            <GraphInner fullscreen />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
