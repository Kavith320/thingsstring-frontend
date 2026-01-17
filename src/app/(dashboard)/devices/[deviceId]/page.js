"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { apiRequest } from "../../../../lib/api";

import TelemetryGraph from "@/components/devices/TelemetryGraph";
import SensorsGrid from "@/components/devices/SensorsGrid";

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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="font-semibold">{title}</div>
        {right ? <div className="shrink-0">{right}</div> : null}
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
      setDevice(d);
    } catch (e) {
      setErr(e.message || "Failed to load device");
    } finally {
      setLoading(false);
    }
  }, [fetchDevice]);

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

  const secsAgo = meta.lastSeenMs
    ? Math.round((Date.now() - meta.lastSeenMs) / 1000)
    : null;

  const actuatorCount = Object.keys(meta.controlActuators || {}).length;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-4 space-y-4">
      {/* Header */}
      <div className="rounded-2xl border p-4 sm:p-5 border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/60">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="text-xl sm:text-2xl font-semibold truncate">{meta.name}</div>

            <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 break-all">
              ID:{" "}
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {meta.id}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Badge>{`FW: ${meta.firmware}`}</Badge>
              <Badge>{`Model: ${meta.model}`}</Badge>
              <Badge tone={meta.online ? "green" : "red"}>
                {meta.online ? "ONLINE" : "OFFLINE"}
              </Badge>
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

          <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
            <a
              href={`/devices/${encodeURIComponent(meta.id)}/schedules`}
              className="w-full sm:w-auto text-center rounded-xl border px-3 py-2 text-sm border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
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
      </div>

      {/* ✅ Sensors tiles */}
      <Card title="Sensors (Latest)">
       <SensorsGrid lastTelemetry={device?.last_telemetry} />

      </Card>

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
              const desired = getActDesiredState(act);
              const rowBusy = busyAct === actKey;

              return (
                <div
                  key={actKey}
                  className="rounded-2xl border p-4 border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/40"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="font-semibold break-all">{actKey}</div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                        Type: {type}
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                        Live: <span className="font-medium">{liveState}</span> • Desired:{" "}
                        <span className="font-medium">{desired}</span>
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                        Mode:{" "}
                        <span className="font-medium">{auto ? "AUTO" : "MANUAL"}</span>
                      </div>
                      {auto && (
                        <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                          Auto mode enabled — switch to MANUAL to control.
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
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
                    <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                      Sending…
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Graphs */}
      <Card title="Telemetry Graphs (Last 24h)">
        <TelemetryGraph history={history} />
      </Card>
    </div>
  );
}
