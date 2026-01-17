"use client";

import { useMemo, useRef, useState } from "react";


import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  CartesianGrid,
  Brush,
  ReferenceArea,
  Tooltip,
} from "recharts";

/* -------- Mongo ObjectId -> timestamp helpers -------- */
function objectIdToMs(oid) {
  if (!oid || typeof oid !== "string" || oid.length < 8) return null;
  const sec = parseInt(oid.slice(0, 8), 16);
  if (!Number.isFinite(sec)) return null;
  return sec * 1000;
}

/* ---------------- chart palette ---------------- */
const CHART_COLORS = [
  "#22c55e",
  "#3b82f6",
  "#f59e0b",
  "#ef4444",
  "#a855f7",
  "#06b6d4",
  "#f97316",
  "#84cc16",
  "#e11d48",
  "#14b8a6",
];

function colorForKey(key, allKeys) {
  const idx = Math.max(0, allKeys.indexOf(key));
  return CHART_COLORS[idx % CHART_COLORS.length];
}

function clampDomain([a, b]) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (a === b) return null;
  return a < b ? [a, b] : [b, a];
}

/* ---------------- dark tooltip (fixes white box) ---------------- */
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-950/95 px-3 py-2 text-xs text-zinc-100 shadow-2xl">
      <div className="mb-2 text-[11px] text-zinc-400">
        {label ? new Date(label).toLocaleString() : ""}
      </div>

      <div className="space-y-1">
        {payload.map((item) => (
          <div key={item.dataKey} className="flex items-center justify-between gap-4">
            <span className="truncate" style={{ color: item.color }}>
              {item.name}
            </span>
            <span className="font-semibold text-zinc-100">
              {typeof item.value === "number" ? item.value : String(item.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- main component ---------------- */
export default function TelemetryGraph({ history = [] }) {
  const [open, setOpen] = useState(false);

  // Zoom state
  const [xDomain, setXDomain] = useState(null);
  const [refLeft, setRefLeft] = useState(null);
  const [refRight, setRefRight] = useState(null);

  // Selected keys (default will be chosen without useEffect)
  const [selectedKeys, setSelectedKeys] = useState([]);

  // Prevent re-initializing defaults repeatedly
  const didInitDefaults = useRef(false);

  function resetZoom() {
    setXDomain(null);
    setRefLeft(null);
    setRefRight(null);
  }

  // Normalize to chart points (last 24h) WITHOUT Date.now() in render loop
  // eslint-disable-next-line react-hooks/purity
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

        return { ...h, __ms: ms };
      })
      .filter((p) => p.__ms && p.__ms >= fromMs)
      .sort((a, b) => a.__ms - b.__ms);
  }, [history]);

  const numericKeys = useMemo(() => {
    const ignore = new Set(["__ms", "_id", "deviceId", "id", "device", "actuators"]);
    const keys = new Set();
    for (const row of chartData) {
      for (const [k, v] of Object.entries(row)) {
        if (ignore.has(k)) continue;
        if (typeof v === "number" && Number.isFinite(v)) keys.add(k);
      }
    }
    return Array.from(keys).sort();
  }, [chartData]);

  // Set defaults ONCE (no useEffect => no eslint set-state-in-effect error)
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
        const v = row[key];
        if (typeof v === "number" && Number.isFinite(v)) {
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
    }

    if (!Number.isFinite(min) || !Number.isFinite(max)) return ["auto", "auto"];
    if (min === max) return [min - 1, max + 1];

    const padding = (max - min) * 0.08;
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

  function toggleKey(k) {
    setSelectedKeys((prev) => {
      const has = prev.includes(k);
      if (has) return prev.filter((x) => x !== k);

      // allow up to 4 (desktop). for mobile readability we still show fine.
      if (prev.length >= 4) return prev;
      return [...prev, k];
    });
  }

  function GraphInner({ fullscreen = false }) {
    const heightCls = fullscreen
      ? "h-[72vh] sm:h-[76vh] lg:h-[80vh]"
      : "h-[260px] sm:h-[320px] lg:h-[380px]";

    const maxChip =
      fullscreen ? 4 : 4; // keep same, but you can set fullscreen=6 if you want

    const showKeys =
      fullscreen
        ? safeSelectedKeys
        : safeSelectedKeys.length > mobileMax
        ? safeSelectedKeys.slice(0, mobileMax)
        : safeSelectedKeys;

    return (
      <div className="space-y-3">
        {/* controls */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            Select fields (max {maxChip}):
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Points: {chartData.length}
            </div>

            <button
              onClick={resetZoom}
              className="rounded-xl border px-3 py-2 text-xs border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Reset Zoom
            </button>

            <button
              onClick={() => setOpen(true)}
              className="rounded-xl border px-3 py-2 text-xs border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Fullscreen
            </button>
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
                  "text-xs px-2 py-1 rounded-full border flex items-center gap-2",
                  checked
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-black"
                    : "border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-950/40",
                ].join(" ")}
              >
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: stroke }} />
                {checked ? "✓ " : ""}
                {k}
              </button>
            );
          })}

          <button
            onClick={() => setSelectedKeys(numericKeys.slice(0, 2))}
            className="text-xs px-2 py-1 rounded-full border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-950/40"
          >
            Reset Fields
          </button>
        </div>

        {/* legend */}
        <div className="flex flex-wrap gap-2">
          {showKeys.map((k) => (
            <span
              key={k}
              className="text-xs px-2 py-1 rounded-full border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-950/40 flex items-center gap-2"
            >
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: colorForKey(k, numericKeys) }} />
              {k}
            </span>
          ))}

          {!fullscreen && safeSelectedKeys.length > mobileMax && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              (mobile showing {mobileMax} lines)
            </span>
          )}
        </div>

        {/* chart */}
        <div className="rounded-2xl border p-3 border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950/40">
          <div className={`w-full ${heightCls}`}>
            <ResponsiveContainer>
              <LineChart
                data={chartData}
                onMouseDown={(e) => {
                  if (!fullscreen) return; // reduce accidental zoom on mobile
                  if (!e || e.activeLabel == null) return;
                  setRefLeft(e.activeLabel);
                  setRefRight(null);
                }}
                onMouseMove={(e) => {
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
                  const next = clampDomain([refLeft, refRight]);
                  if (next) setXDomain(next);
                  setRefLeft(null);
                  setRefRight(null);
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />

                <XAxis
                  dataKey="__ms"
                  type="number"
                  domain={xDomain || ["dataMin", "dataMax"]}
                  tickFormatter={(ms) => new Date(ms).toLocaleTimeString()}
                />

                <YAxis domain={yDomain} />

                {/* ✅ this removes the white tooltip forever */}
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ stroke: "#52525b", strokeDasharray: "4 4" }}
                />

                {refLeft != null && refRight != null ? (
                  <ReferenceArea x1={refLeft} x2={refRight} strokeOpacity={0.2} />
                ) : null}

                {(fullscreen ? safeSelectedKeys : showKeys).map((k) => (
                  <Line
                    key={k}
                    type="monotone"
                    dataKey={k}
                    dot={false}
                    isAnimationActive={fullscreen} // smoother only in fullscreen
                    animationDuration={350}
                    activeDot={{ r: 4 }}
                    strokeWidth={2}
                    stroke={colorForKey(k, numericKeys)}
                  />
                ))}

                <Brush
                  dataKey="__ms"
                  height={28}
                  travellerWidth={10}
                  tickFormatter={(ms) => new Date(ms).toLocaleTimeString()}
                  onChange={(range) => {
                    if (!range) return;
                    const start = chartData?.[range.startIndex]?.__ms;
                    const end = chartData?.[range.endIndex]?.__ms;
                    const next = clampDomain([start, end]);
                    setXDomain(next);
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            {fullscreen
              ? "Drag to zoom • Use bottom slider to zoom/scroll"
              : "Tip: use Fullscreen for zooming on mobile"}{" "}
            • Data range: {dataRangeText}
          </div>
        </div>
      </div>
    );
  }

  if (!chartData.length) {
    return (
      <div className="text-sm text-zinc-500 dark:text-zinc-400">
        No telemetry history (last 24h).
      </div>
    );
  }

  if (!numericKeys.length) {
    return (
      <div className="text-sm text-zinc-500 dark:text-zinc-400">
        No numeric telemetry fields found to plot.
      </div>
    );
  }

  return (
    <>
      <GraphInner fullscreen={false} />

      {/* Fullscreen Modal */}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/70 p-3 sm:p-6 flex items-center justify-center">
          <div className="w-full max-w-6xl rounded-3xl border border-white/10 bg-zinc-950/80 backdrop-blur-xl shadow-2xl">
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/10">
              <div className="text-sm font-semibold text-white">Telemetry Graph (Fullscreen)</div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/90 hover:bg-white/10"
              >
                Close
              </button>
            </div>
            <div className="p-4 sm:p-6">
              <GraphInner fullscreen />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
