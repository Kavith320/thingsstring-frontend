"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { apiRequest } from "../../../../lib/api";
import { formatLastSeen } from "@/lib/utils";

import TelemetryGraph from "@/components/devices/TelemetryGraph";
import SensorsGrid from "@/components/devices/SensorsGrid";
import LoadingSignal from "@/components/LoadingSignal";
import Switch from "@/components/common/Switch";
import { Sparkles, Power } from "lucide-react";

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
    <div className="rounded-3xl border shadow-sm border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950/40 backdrop-blur-md overflow-hidden transition-all duration-300">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800/50">
        <div className="font-bold text-zinc-900 dark:text-white tracking-tight">{title}</div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="p-4 sm:p-6">{children}</div>
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
    <span className={`text-xs px-2 py-1 rounded-full border whitespace-nowrap ${cls}`}>
      {s || "-"}
    </span>
  );
}

function Btn({ children, onClick, disabled, variant = "outline", type = "button" }) {
  const base = "rounded-xl px-3 py-2 text-sm disabled:opacity-60 whitespace-nowrap";
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

/* ---------------- Page ---------------- */

export default function DeviceDetailsPage() {
  const params = useParams();
  const deviceId = params?.deviceId;

  const [device, setDevice] = useState(null);
  const [history, setHistory] = useState([]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [msg, setMsg] = useState("");
  const [busyAct, setBusyAct] = useState("");

  const fetchDevice = useCallback(async () => {
    const res = await apiRequest(`/api/devices/${deviceId}`, { method: "GET" });
    return res?.device || res;
  }, [deviceId]);

  const fetchHistory = useCallback(async () => {
    const res = await apiRequest(
      `/api/devices/${deviceId}/telemetry?limit=10000`,
      { method: "GET" }
    );
    return Array.isArray(res) ? res : res?.telemetry || res?.items || [];
  }, [deviceId]);

  const loadDeviceOnce = useCallback(async () => {
    setErr("");
    try {
      const d = await fetchDevice();
      setDevice(prev => {
        if (!prev || !busyAct) return d;

        // Preserve busy actuator state
        const last = d.last_telemetry || {};
        const acts = last.actuators || {};
        const prevActs = prev.last_telemetry?.actuators || {};

        if (prevActs[busyAct] !== undefined) {
          return {
            ...d,
            last_telemetry: {
              ...last,
              actuators: { ...acts, [busyAct]: prevActs[busyAct] }
            }
          };
        }
        return d;
      });
    } catch (e) {
      setErr(e.message || "Failed to load device");
    } finally {
      setLoading(false);
    }
  }, [fetchDevice, busyAct]);

  const loadHistoryOnce = useCallback(async () => {
    try {
      const list = await fetchHistory();
      setHistory(list);
    } catch {
      // graphs optional
    }
  }, [fetchHistory]);

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
  }, [deviceId, loadDeviceOnce, loadHistoryOnce]);

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
      cfgActuators: cfg?.actuators || {},
      controlActuators: control?.actuators || {},
      telemetryActuators: last?.actuators || {},
      lastTelemetry: last,
      online: st.online,
      lastSeenMs: st.lastSeenMs,
      ageMs: st.ageMs,
    };
  }, [device, deviceId]);

  function setLocalTelemetryActuator(actKey, newState) {
    setDevice((prev) => {
      if (!prev) return prev;
      const last = prev.last_telemetry || {};
      const acts = last.actuators || {};
      return {
        ...prev,
        last_telemetry: { ...last, actuators: { ...acts, [actKey]: newState } },
      };
    });
  }

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
              default: { ...def, ...(patch?.default || {}) },
            },
          },
        },
      };
    });
  }

  async function sendActuatorPatch(actKey, { state, auto }) {
    setMsg("");
    setBusyAct(actKey);

    try {
      const endpoint = `/api/devices/${meta.id}/control`;
      const type =
        meta.controlActuators?.[actKey]?.type || meta.cfgActuators?.[actKey]?.type;

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

      await apiRequest(endpoint, { method: "POST", body: payload });
    } catch (e) {
      setMsg(`❌ Command failed: ${e.message}`);
    } finally {
      // Hold busy state for 5 seconds to allow hardware to sync
      setTimeout(() => {
        setBusyAct("");
      }, 5000);
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

  const lastSeenFormatted = meta.lastSeenMs
    ? formatLastSeen(meta.lastSeenMs)
    : null;

  const actuatorCount = Object.keys(meta.controlActuators || {}).length;

  return (
    <div className="mx-auto w-full max-w-6xl px-3 sm:px-6 lg:px-8 py-4 space-y-4">
      {/* Header */}
      <div className="rounded-3xl border p-5 sm:p-6 border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950/40 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white truncate">
              {meta.name}
            </h1>

            <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
              <span className="font-mono text-xs px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                {meta.id}
              </span>
            </div>

            <div className="pt-3 flex flex-wrap gap-2">
              <Badge>{`V: ${meta.firmware}`}</Badge>
              <Badge>{`Model: ${meta.model}`}</Badge>
              <Badge tone={meta.online ? "green" : "red"}>
                {meta.online ? "ONLINE" : "OFFLINE"}
              </Badge>
              {lastSeenFormatted && <Badge>{`Updated: ${lastSeenFormatted}`}</Badge>}
            </div>

            <div className="pt-2 text-[10px] text-zinc-400 uppercase tracking-widest font-medium">
              Refresh Interval: 5s • Last Ping: {Math.round(meta.ageMs / 1000)}s ago
            </div>

            {msg && (
              <div className="mt-4 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-xs font-medium text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20 animate-in fade-in slide-in-from-top-1">
                {msg}
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 w-full lg:w-auto">
            <a
              href={`/devices/${encodeURIComponent(meta.id)}/schedules`}
              className="flex-1 sm:flex-none inline-flex items-center justify-center rounded-2xl border border-zinc-200 px-6 py-3 text-sm font-bold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900 transition-all active:scale-95 shadow-sm"
            >
              Schedules
            </a>

            <button
              onClick={() => {
                loadDeviceOnce();
                loadHistoryOnce();
              }}
              className="flex-1 sm:flex-none inline-flex items-center justify-center rounded-2xl bg-zinc-900 px-6 py-3 text-sm font-bold text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 transition-all active:scale-95 shadow-lg shadow-zinc-900/10 dark:shadow-white/5"
            >
              Force Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ✅ Actuators (hide / show nice empty state) */}
      <Card
        title="Actuators (Mode + Manual Control)"
        right={
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            {actuatorCount ? `${actuatorCount} actuators` : "No actuators"}
          </div>
        }
      >
        {actuatorCount === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-300">
            This device has no actuators configured.
          </div>
        ) : (
          <div className="grid gap-3">
            {Object.entries(meta.controlActuators).map(([actKey, act]) => {
              const type = act?.type || meta.cfgActuators?.[actKey]?.type || "-";
              const auto = getActAuto(act);
              const liveState = getActLiveState(actKey, meta.telemetryActuators, act);
              const rowBusy = busyAct === actKey;

              return (
                <div
                  key={actKey}
                  className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950/35"
                >
                  {/* Absolute Loading Overlay - Prevents layout jumping */}
                  {rowBusy && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-[1px] dark:bg-zinc-950/60 animate-in fade-in duration-300">
                      <LoadingSignal size="sm" />
                    </div>
                  )}

                  <div className="p-4 sm:p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      {/* Left: Info */}
                      <div className="flex items-center justify-between lg:justify-start gap-3">
                        <div className="flex items-center gap-3">
                          <div className="font-bold text-zinc-900 dark:text-white text-base tracking-tight">{actKey}</div>
                          <Badge>{type}</Badge>
                        </div>
                        {/* Mobile/Tablet State Badge (right-aligned) */}
                        <div className="lg:hidden">
                          <StateBadge state={liveState} />
                        </div>
                      </div>

                      {/* Right: Controls */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 sm:gap-8">
                        <div className="flex items-center justify-between sm:justify-start gap-4 h-10 px-3 sm:px-0 rounded-xl bg-zinc-50 sm:bg-transparent dark:bg-zinc-900/50 sm:dark:bg-transparent">
                          <Switch
                            label="Auto Mode"
                            checked={auto}
                            disabled={rowBusy}
                            variant="emerald"
                            icon={Sparkles}
                            onChange={() => toggleActuatorAuto(actKey)}
                          />
                        </div>

                        <div className="flex items-center justify-between sm:justify-start gap-4 h-10 px-3 sm:px-0 rounded-xl bg-zinc-50 sm:bg-transparent dark:bg-zinc-900/50 sm:dark:bg-transparent">
                          <Switch
                            label="Manual Control"
                            checked={liveState === "ON"}
                            disabled={rowBusy || auto}
                            icon={Power}
                            onChange={(checked) => setActuatorState(actKey, checked ? "ON" : "OFF")}
                          />
                        </div>

                        {/* Desktop State Badge */}
                        <div className="hidden lg:block min-w-[70px] text-right ml-4">
                          <StateBadge state={liveState} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ✅ Sensors tiles */}
      <Card title="Sensors (Latest)">
        <SensorsGrid lastTelemetry={device?.last_telemetry} />
      </Card>

      {/* Graphs */}
      <Card title="Telemetry Graphs (Last 24h)">
        <TelemetryGraph history={history} />
      </Card>
    </div>
  );
}
