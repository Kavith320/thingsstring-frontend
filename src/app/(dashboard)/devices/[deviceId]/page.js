"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { apiRequest } from "../../../../lib/api";
import { getToken } from "../../../../lib/auth";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Brush,
  ReferenceArea,
} from "recharts";

/* ---------------- helpers: time + online ---------------- */

function objectIdToMs(oid) {
  if (!oid || typeof oid !== "string" || oid.length < 8) return null;
  const sec = parseInt(oid.slice(0, 8), 16);
  if (!Number.isFinite(sec)) return null;
  return sec * 1000;
}

function getLastTelemetryMs(lastTelemetry) {
  if (!lastTelemetry) return null;

  const t =
    lastTelemetry.updatedAt ||
    lastTelemetry.createdAt ||
    lastTelemetry.ts ||
    lastTelemetry.timestamp ||
    null;

  if (t) {
    const ms = new Date(t).getTime();
    if (Number.isFinite(ms)) return ms;
  }

  return objectIdToMs(lastTelemetry._id);
}

function getOnlineInfo(device, maxAgeMs = 60_000) {
  const ms = getLastTelemetryMs(device?.last_telemetry);
  if (!ms) return { online: false, lastSeenMs: null, ageMs: Infinity };
  const ageMs = Date.now() - ms;
  return { online: ageMs <= maxAgeMs, lastSeenMs: ms, ageMs };
}

/* ---------------- helpers: actuator read ---------------- */

function getActAuto(act) {
  if (!act) return false;
  if (typeof act?.default?.auto === "boolean") return act.default.auto;
  if (typeof act?.auto === "boolean") return act.auto;
  return false;
}

function getActDesiredState(act) {
  if (!act) return "OFF";
  if (act?.default?.state) return act.default.state;
  if (act?.state) return act.state;
  return "OFF";
}

function getActLiveState(actKey, telemetryActuators, act) {
  const t = telemetryActuators?.[actKey];
  if (t) return t;
  if (act?.state) return act.state;
  if (act?.default?.state) return act.default.state;
  return "OFF";
}

/* ---------------- UI helpers ---------------- */

function Card({ title, right, children }) {
  return (
    <div className="rounded-2xl border shadow-sm border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="font-semibold">{title}</div>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Badge({ tone = "neutral", children }) {
  const cls =
    tone === "green"
      ? "bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400"
      : tone === "red"
      ? "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-300"
      : "bg-zinc-500/10 border-zinc-500/30 text-zinc-700 dark:text-zinc-200";

  return (
    <span className={`text-xs px-2 py-1 rounded-full border ${cls}`}>
      {children}
    </span>
  );
}

function StateBadge({ state }) {
  const s = String(state || "").toUpperCase();
  const on = s === "ON";
  const off = s === "OFF";

  const cls = on
    ? "bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400"
    : off
    ? "bg-zinc-500/10 border-zinc-500/30 text-zinc-700 dark:text-zinc-200"
    : "bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-300";

  return (
    <span className={`text-xs px-2 py-1 rounded-full border ${cls}`}>
      {s || "-"}
    </span>
  );
}

function Btn({ children, onClick, disabled, variant = "outline", type = "button" }) {
  const base = "rounded-xl px-3 py-2 text-sm disabled:opacity-60";
  const cls =
    variant === "solid"
      ? "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
      : "border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${cls}`}
    >
      {children}
    </button>
  );
}

/* ---------------- chart color palette ---------------- */
// Distinct colors (fixed order for consistency)
const CHART_COLORS = [
  "#22c55e", // green
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#ef4444", // red
  "#a855f7", // purple
  "#06b6d4", // cyan
  "#f97316", // orange
  "#84cc16", // lime
  "#e11d48", // rose
  "#14b8a6", // teal
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

/* ---------------- Page ---------------- */

export default function DeviceDetailsPage() {
  const params = useParams();
  const deviceId = params?.deviceId;

  const [device, setDevice] = useState(null);
  const [history, setHistory] = useState([]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [msg, setMsg] = useState(""); // errors only
  const [busyAct, setBusyAct] = useState("");

  const [selectedKeys, setSelectedKeys] = useState([]);

  // zoom state
  const [xDomain, setXDomain] = useState(null); // [minMs, maxMs] or null
  const [refLeft, setRefLeft] = useState(null);
  const [refRight, setRefRight] = useState(null);

  function resetZoom() {
    setXDomain(null);
    setRefLeft(null);
    setRefRight(null);
  }

  useEffect(() => {
    resetZoom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  async function fetchDevice() {
    const token = getToken();
    const res = await apiRequest(`/api/devices/${deviceId}`, { token });
    return res?.device || res;
  }

  async function fetchHistory() {
    const token = getToken();
    // big limit so 24h is possible (depends on telemetry rate + retention)
    const res = await apiRequest(`/api/devices/${deviceId}/telemetry?limit=10000`, {
      token,
    });
    return Array.isArray(res) ? res : res?.telemetry || res?.items || [];
  }

  async function loadDeviceOnce() {
    setErr("");
    try {
      const d = await fetchDevice();
      setDevice(d);
    } catch (e) {
      setErr(e.message || "Failed to load device");
    } finally {
      setLoading(false);
    }
  }

  async function loadHistoryOnce() {
    try {
      const list = await fetchHistory();
      setHistory(list);
    } catch {
      // graphs optional
    }
  }

  // Polling optimized
  useEffect(() => {
    if (!deviceId) return;

    setLoading(true);
    loadDeviceOnce();
    loadHistoryOnce();

    const pollDevice = setInterval(loadDeviceOnce, 5_000);
    const pollHistory = setInterval(loadHistoryOnce, 30_000);

    return () => {
      clearInterval(pollDevice);
      clearInterval(pollHistory);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  const meta = useMemo(() => {
    const cfg = device?.config || {};
    const dev = cfg?.device || {};
    const control = device?.control || {};
    const last = device?.last_telemetry || {};
    const st = getOnlineInfo(device, 60_000);

    return {
      id: device?.deviceId || dev?.device_id || deviceId,
      name: dev?.name || dev?.model || deviceId,
      model: dev?.model || "-",
      firmware: dev?.firmware || "-",
      topics: cfg?.topics || {},
      cfgActuators: cfg?.actuators || {},
      controlActuators: control?.actuators || {},
      lastTelemetry: last,
      telemetryActuators: last?.actuators || {},
      online: st.online,
      lastSeenMs: st.lastSeenMs,
      ageMs: st.ageMs,
    };
  }, [device, deviceId]);

  // Telemetry list (scalar fields)
  const telemetryList = useMemo(() => {
    const t = meta.lastTelemetry || {};
    return Object.entries(t)
      .filter(([k, v]) => typeof v !== "object")
      .map(([k, v]) => ({ k, v }));
  }, [meta.lastTelemetry]);

  // 24h chart window (client-side)
  const chartData = useMemo(() => {
    const now = Date.now();
    const fromMs = now - 24 * 60 * 60 * 1000;

    const points = (history || [])
      .map((h) => {
        const ms =
          (h.updatedAt && new Date(h.updatedAt).getTime()) ||
          (h.createdAt && new Date(h.createdAt).getTime()) ||
          (h.ts && new Date(h.ts).getTime()) ||
          (h.timestamp && new Date(h.timestamp).getTime()) ||
          objectIdToMs(h._id) ||
          null;

        return {
          ...h,
          __ms: ms,
        };
      })
      .filter((p) => p.__ms && p.__ms >= fromMs)
      .sort((a, b) => a.__ms - b.__ms);

    return points;
  }, [history]);

  // Detect numeric keys
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

  // Default select (max 2)
  useEffect(() => {
    if (!numericKeys.length) return;
    setSelectedKeys((prev) => (prev && prev.length ? prev : numericKeys.slice(0, 2)));
  }, [numericKeys]);

  // Tight Y-axis scaling based on selected fields
  const yDomain = useMemo(() => {
    if (!chartData.length || !selectedKeys.length) return ["auto", "auto"];

    let min = Infinity;
    let max = -Infinity;

    for (const row of chartData) {
      for (const key of selectedKeys) {
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
  }, [chartData, selectedKeys]);

  // Optimistic update: telemetry actuator state
  function setLocalTelemetryActuator(actKey, newState) {
    setDevice((prev) => {
      if (!prev) return prev;
      const last = prev.last_telemetry || {};
      const acts = last.actuators || {};
      return {
        ...prev,
        last_telemetry: {
          ...last,
          actuators: { ...acts, [actKey]: newState },
        },
      };
    });
  }

  // Optimistic update: control actuator default + top-level
  function setLocalControlActuator(actKey, patch) {
    setDevice((prev) => {
      if (!prev) return prev;
      const control = prev.control || {};
      const acts = control.actuators || {};
      const cur = acts[actKey] || {};
      const def = cur.default || {};

      return {
        ...prev,
        control: {
          ...control,
          actuators: {
            ...acts,
            [actKey]: {
              ...cur,
              ...(patch || {}),
              default: {
                ...def,
                ...(patch?.default || {}),
              },
            },
          },
        },
      };
    });
  }

  // Sender: send BOTH default + top-level (errors only; no success message)
  async function sendActuatorPatch(actKey, { state, auto }) {
    setMsg("");
    setBusyAct(actKey);

    try {
      const token = getToken();
      const endpoint = `/api/devices/${meta.id}/control`;

      const type =
        meta.controlActuators?.[actKey]?.type ||
        meta.cfgActuators?.[actKey]?.type;

      const payload = {
        actuators: {
          [actKey]: {
            ...(type ? { type } : {}),
            auto,
            state,
            default: { auto, state },
          },
        },
      };

      await apiRequest(endpoint, { method: "POST", token, body: payload });
    } catch (e) {
      setMsg(`❌ Command failed: ${e.message}`);
    } finally {
      setBusyAct("");
    }
  }

  async function toggleActuatorAuto(actKey) {
    const act = meta.controlActuators?.[actKey];
    const currentAuto = getActAuto(act);
    const nextAuto = !currentAuto;

    const state = getActLiveState(actKey, meta.telemetryActuators, act) || "OFF";

    setLocalControlActuator(actKey, { auto: nextAuto, default: { auto: nextAuto } });
    await sendActuatorPatch(actKey, { auto: nextAuto, state });
  }

  async function setActuatorState(actKey, state) {
    const act = meta.controlActuators?.[actKey];
    const auto = getActAuto(act);

    if (auto) {
      setMsg("⚠️ Switch to MANUAL to control this actuator.");
      return;
    }

    setLocalTelemetryActuator(actKey, state);
    setLocalControlActuator(actKey, { state, default: { state } });

    await sendActuatorPatch(actKey, { auto, state });
  }

  if (loading && !device) {
    return <div className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</div>;
  }

  if (err) {
    return (
      <div className="rounded-2xl border p-4 border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300">
        {err}
      </div>
    );
  }

  if (!device) return null;

  const secsAgo = meta.lastSeenMs ? Math.round((Date.now() - meta.lastSeenMs) / 1000) : null;

  const dataRangeText =
    chartData.length > 0
      ? `${new Date(chartData[0].__ms).toLocaleString()} → ${new Date(
          chartData[chartData.length - 1].__ms
        ).toLocaleString()}`
      : "-";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border p-5 border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/60 flex items-start justify-between gap-4">
        <div>
          <div className="text-2xl font-semibold">{meta.name}</div>
          <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 break-all">
            ID: <span className="font-medium text-zinc-900 dark:text-zinc-100">{meta.id}</span>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Badge>{`FW: ${meta.firmware}`}</Badge>
            <Badge>{`Model: ${meta.model}`}</Badge>
            <Badge tone={meta.online ? "green" : "red"}>{meta.online ? "ONLINE" : "OFFLINE"}</Badge>
            {secsAgo !== null && <Badge>{`Seen: ${secsAgo}s ago`}</Badge>}
          </div>

          <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Offline if telemetry age &gt; 60s • Current age: {Math.round(meta.ageMs / 1000)}s
          </div>

          {msg && (
            <div className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
              {msg}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <a
            href={`/devices/${encodeURIComponent(meta.id)}/schedules`}
            className="rounded-xl border px-3 py-2 text-sm border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Schedules
          </a>

          <Btn
            onClick={() => {
              loadDeviceOnce();
              loadHistoryOnce();
            }}
          >
            Refresh
          </Btn>
        </div>
      </div>

      {/* Telemetry + Topics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Telemetry (Latest)">
          {telemetryList.length === 0 ? (
            <div className="text-sm text-zinc-500 dark:text-zinc-400">No telemetry yet.</div>
          ) : (
            <div className="space-y-2">
              {telemetryList.map((x) => (
                <div key={x.k} className="flex justify-between gap-4">
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">{x.k}</div>
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100 break-all text-right">
                    {String(x.v)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="MQTT Topics">
          <div className="space-y-2">
            <div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Telemetry</div>
              <div className="text-sm break-all">{meta.topics?.telemetry || "-"}</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Control</div>
              <div className="text-sm break-all">{meta.topics?.control || "-"}</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Config</div>
              <div className="text-sm break-all">{meta.topics?.config || "-"}</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Actuators */}
      <Card title="Actuators (Mode + Manual Control)">
        {Object.keys(meta.controlActuators || {}).length === 0 ? (
          <div className="text-sm text-zinc-500 dark:text-zinc-400">No actuators found.</div>
        ) : (
          <div className="grid gap-3">
            {Object.entries(meta.controlActuators).map(([actKey, act]) => {
              const type = act?.type || meta.cfgActuators?.[actKey]?.type || "-";
              const auto = getActAuto(act);
              const liveState = getActLiveState(actKey, meta.telemetryActuators, act);
              const desired = getActDesiredState(act);
              const rowBusy = busyAct === actKey;

              return (
                <div
                  key={actKey}
                  className="rounded-2xl border p-4 border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/40"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold">{actKey}</div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                        Type: {type}
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                        Live: <span className="font-medium">{liveState}</span> • Desired:{" "}
                        <span className="font-medium">{desired}</span>
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                        Mode: <span className="font-medium">{auto ? "AUTO" : "MANUAL"}</span>
                      </div>
                      {auto && (
                        <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                          Auto mode enabled — switch to MANUAL to control.
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <StateBadge state={liveState} />

                      <Btn disabled={rowBusy} onClick={() => toggleActuatorAuto(actKey)}>
                        {auto ? "AUTO" : "MANUAL"}
                      </Btn>

                      <Btn disabled={rowBusy || auto} onClick={() => setActuatorState(actKey, "ON")}>
                        ON
                      </Btn>

                      <Btn disabled={rowBusy || auto} onClick={() => setActuatorState(actKey, "OFF")}>
                        OFF
                      </Btn>
                    </div>
                  </div>

                  {rowBusy && (
                    <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Sending…</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Graphs */}
      <Card
        title="Telemetry Graphs (Last 24h)"
        right={
          <div className="flex items-center gap-2">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">Points: {chartData.length}</div>
            <Btn onClick={resetZoom} disabled={!chartData.length}>Reset Zoom</Btn>
          </div>
        }
      >
        {chartData.length === 0 ? (
          <div className="text-sm text-zinc-500 dark:text-zinc-400">
            No telemetry history (last 24h).
          </div>
        ) : numericKeys.length === 0 ? (
          <div className="text-sm text-zinc-500 dark:text-zinc-400">
            No numeric telemetry fields found to plot.
          </div>
        ) : (
          <div className="space-y-3">
            {/* selector */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                Select fields (max 4):
              </div>

              {numericKeys.map((k) => {
                const checked = selectedKeys.includes(k);
                const stroke = colorForKey(k, numericKeys);
                return (
                  <button
                    key={k}
                    onClick={() => {
                      setSelectedKeys((prev) => {
                        const has = prev.includes(k);
                        if (has) return prev.filter((x) => x !== k);
                        if (prev.length >= 4) return prev;
                        return [...prev, k];
                      });
                    }}
                    className={[
                      "text-xs px-2 py-1 rounded-full border flex items-center gap-2",
                      checked
                        ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-black"
                        : "border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-950/40",
                    ].join(" ")}
                    title="Toggle"
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
              {selectedKeys.map((k) => (
                <span
                  key={k}
                  className="text-xs px-2 py-1 rounded-full border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-950/40 flex items-center gap-2"
                >
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: colorForKey(k, numericKeys) }} />
                  {k}
                </span>
              ))}
            </div>

            <div className="rounded-2xl border p-3 border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950/40">
              <div style={{ width: "100%", height: 360 }}>
                <ResponsiveContainer>
                  <LineChart
                    data={chartData}
                    onMouseDown={(e) => {
                      if (!e || e.activeLabel == null) return;
                      setRefLeft(e.activeLabel);
                      setRefRight(null);
                    }}
                    onMouseMove={(e) => {
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

                    <Tooltip
                      labelFormatter={(ms) => new Date(ms).toLocaleString()}
                      cursor={{ strokeDasharray: "3 3" }}
                    />

                    {refLeft != null && refRight != null ? (
                      <ReferenceArea x1={refLeft} x2={refRight} strokeOpacity={0.2} />
                    ) : null}

                    {selectedKeys.map((k) => (
                      <Line
                        key={k}
                        type="monotone"
                        dataKey={k}
                        dot={false}
                        activeDot={{ r: 4 }}
                        strokeWidth={2}
                        stroke={colorForKey(k, numericKeys)}
                      />
                    ))}

                    {/* back chart slider */}
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
                Drag on chart to zoom • Use bottom slider to zoom/scroll • Data range: {dataRangeText}
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
