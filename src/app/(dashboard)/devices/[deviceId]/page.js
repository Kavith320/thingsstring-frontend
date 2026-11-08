"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { apiRequest, apiDownload } from "../../../../lib/api";
import { formatLastSeen, isActuatorAuto, DEVICE_OFFLINE_MS } from "@/lib/utils";
import Link from "next/link";
import StatusPill from "@/components/common/StatusPill";
import { IconBadge } from "@/components/common/ui";
import DeviceCustomizeModal from "@/components/devices/DeviceCustomizeModal";
import { arrangeEntries, deviceDisplayName, deviceOnline, deviceUi, deviceRole, canControl, canManageSharing, ROLE_LABELS } from "@/lib/deviceUi";
import DeviceSharingModal from "@/components/devices/DeviceSharingModal";
import DeviceActivity from "@/components/devices/DeviceActivity";

import TelemetryGraph from "@/components/devices/TelemetryGraph";
import SensorsGrid from "@/components/devices/SensorsGrid";
import LoadingSignal from "@/components/LoadingSignal";
import Switch from "@/components/common/Switch";
import { Power, Download, ChevronDown, CalendarClock, RefreshCw, SlidersHorizontal, Radio, Users, Eye } from "lucide-react";

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

function getOnlineInfo(device, maxAgeMs = DEVICE_OFFLINE_MS) {
  const ms = getLastTelemetryMs(device?.last_telemetry);
  if (!ms) return { online: false, lastSeenMs: null, ageMs: Infinity };
  const ageMs = Date.now() - ms;
  return { online: ageMs <= maxAgeMs, lastSeenMs: ms, ageMs };
}

/* ---------------- helpers: actuator read ---------------- */

// Same rule as the backend (live `auto` first, then `default.auto`)
const getActAuto = isActuatorAuto;

function getActLiveState(actKey, telemetryActuators, act) {
  const t = telemetryActuators?.[actKey];
  if (t) return t;
  if (act?.state) return act.state;
  if (act?.default?.state) return act.default.state;
  return "OFF";
}

/* ---------------- CSV export ---------------- */

const EXPORT_RANGES = [
  { label: "All stored data", ms: null },
  { label: "Last 7 days", ms: 7 * 24 * 60 * 60 * 1000 },
  { label: "Last 24 hours", ms: 24 * 60 * 60 * 1000 },
];

/**
 * Downloads the device's raw telemetry as CSV from
 * GET /api/devices/:id/telemetry/export[?from=]. The backend keeps telemetry for a
 * limited time (retentionDays, 7 by default), so "All" means all that is still stored.
 */
function CsvExportButton({ deviceId, onMessage }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function exportCsv(range) {
    setOpen(false);
    setBusy(true);
    onMessage("");
    try {
      const qs = range.ms ? `?from=${new Date(Date.now() - range.ms).toISOString()}` : "";
      // Built here because the backend's CORS setup doesn't expose Content-Disposition
      const safeId = String(deviceId).replace(/[^A-Za-z0-9_-]/g, "_");
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      await apiDownload(
        `/api/devices/${encodeURIComponent(deviceId)}/telemetry/export${qs}`,
        `${safeId}_telemetry_${stamp}.csv`
      );
      onMessage("✅ CSV downloaded.");
    } catch (e) {
      const notSupported = /not found/i.test(e.message) && !/device/i.test(e.message);
      onMessage(
        notSupported
          ? "❌ CSV export isn't available on the server yet (backend needs updating)."
          : `❌ Export failed: ${e.message}`
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={menuRef} className="relative flex-1 min-w-[7.5rem] lg:flex-none">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        aria-haspopup="menu"
        aria-expanded={open}
        className="w-full inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-zinc-200 px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800 transition disabled:opacity-60"
      >
        <Download className="h-4 w-4" />
        {busy ? "Preparing…" : <><span className="sm:hidden">CSV</span><span className="hidden sm:inline">Download CSV</span></>}
        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-full sm:w-52 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
        >
          {EXPORT_RANGES.map((r) => (
            <button
              key={r.label}
              type="button"
              role="menuitem"
              onClick={() => exportCsv(r)}
              className="block w-full px-4 py-2.5 text-left text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- UI helpers ---------------- */

function Card({ title, right, children }) {
  return (
    <section className="rounded-2xl border shadow-sm border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-b border-zinc-100 dark:border-zinc-800">
        <h3 className="font-semibold text-zinc-900 dark:text-white">{title}</h3>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="p-4 sm:p-6">{children}</div>
    </section>
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

/* ---------------- Page ---------------- */

export default function DeviceDetailsPage() {
  const params = useParams();
  const deviceId = params?.deviceId;

  const [device, setDevice] = useState(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [msg, setMsg] = useState("");
  const [busyAct, setBusyAct] = useState("");
  const [customizing, setCustomizing] = useState(false);
  const [sharing, setSharing] = useState(false);
  // Read inside the poller so a busy toggle doesn't restart polling
  const busyActRef = useRef("");
  busyActRef.current = busyAct;

  const fetchDevice = useCallback(async () => {
    const res = await apiRequest(`/api/devices/${deviceId}`, { method: "GET" });
    return res?.device || res;
  }, [deviceId]);

  const loadDeviceOnce = useCallback(async () => {
    try {
      const d = await fetchDevice();
      setErr("");
      const busyAct = busyActRef.current;
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
      // Keep showing the last good data; the page shows a "reconnecting" notice instead
      setErr(e.message || "Failed to load device");
    } finally {
      setLoading(false);
    }
  }, [fetchDevice]);

  useEffect(() => {
    if (!deviceId) return;

    setLoading(true);
    loadDeviceOnce();
    const pollDevice = setInterval(loadDeviceOnce, 5_000);
    return () => clearInterval(pollDevice);
  }, [deviceId, loadDeviceOnce]);

  const meta = useMemo(() => {
    const cfg = device?.config || {};
    const dev = cfg?.device || {};
    const control = device?.control || {};
    const last = device?.last_telemetry || {};
    const st = getOnlineInfo(device);
    const ui = deviceUi(device);
    const controlActuators = control?.actuators || {};

    return {
      id: device?.deviceId || dev?.device_id || deviceId,
      name: device ? deviceDisplayName(device) : deviceId,
      ui,
      role: device ? deviceRole(device) : "owner",
      canControl: device ? canControl(device) : true,
      canManage: device ? canManageSharing(device) : false,
      sharedBy: device?.sharedBy || null,
      // Saved order/labels first; hidden controls are left out (they still run from schedules)
      actuatorEntries: arrangeEntries(Object.keys(controlActuators), ui.actuators).filter((e) => e.visible),
      model: dev?.model || "-",
      firmware: dev?.firmware || "-",
      cfgActuators: cfg?.actuators || {},
      controlActuators: control?.actuators || {},
      telemetryActuators: last?.actuators || {},
      lastTelemetry: last,
      online: device ? deviceOnline(device) : st.online,
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

  // Only a hard error when nothing has loaded yet; later failures are transient
  if (err && !device) {
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

  const actuatorCount = meta.actuatorEntries.length;

  const msgTone = /^❌/.test(msg) ? "red" : /^⚠️/.test(msg) ? "amber" : "green";
  const msgText = msg.replace(/^(❌|⚠️|✅)\s*/u, "");

  return (
    <div className="space-y-4">
      {err && (
        <div role="status" className="rounded-xl border px-4 py-2.5 text-sm border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300">
          Connection interrupted, retrying… Showing the last received data.
        </div>
      )}

      {/* Header */}
      <section className="rounded-2xl border p-4 sm:p-6 border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-start gap-3">
              <IconBadge icon={meta.ui.icon} color={meta.ui.color} fallback={Radio} size="lg" className="hidden sm:grid" />
              <h2 className="min-w-0 flex-1 text-xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white break-words">
                {meta.name}
              </h2>
              <StatusPill online={meta.online} className="mt-1 sm:mt-2" />
            </div>
            {meta.sharedBy && (
              <p className="mt-1.5 inline-flex flex-wrap items-center gap-1.5 rounded-lg bg-indigo-500/10 px-2 py-1 text-xs font-medium text-indigo-700 dark:text-indigo-300">
                <Users className="h-3.5 w-3.5" aria-hidden />
                Shared by {meta.sharedBy.name || meta.sharedBy.email} · You&apos;re {ROLE_LABELS[meta.role]}
              </p>
            )}
            {meta.ui.description && (
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{meta.ui.description}</p>
            )}
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-500 dark:text-zinc-400">
              <span className="font-mono text-xs rounded-md bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">{meta.id}</span>
              <span aria-hidden>·</span>
              <span>{meta.model}</span>
              <span aria-hidden>·</span>
              <span>Firmware {meta.firmware}</span>
              <span aria-hidden>·</span>
              <span>{lastSeenFormatted ? `Last seen ${lastSeenFormatted}` : "No data yet"}</span>
            </p>
          </div>

          <div className="flex flex-wrap gap-2 w-full lg:w-auto lg:flex-nowrap">
            <Link
              href={`/devices/${encodeURIComponent(meta.id)}/schedules`}
              className="flex-1 min-w-[7.5rem] lg:flex-none inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-zinc-200 px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800 transition"
            >
              <CalendarClock className="h-4 w-4" />
              Schedules
            </Link>
            <CsvExportButton deviceId={meta.id} onMessage={setMsg} />
            <div className="flex gap-2 ml-auto">
            {meta.canManage && (
              <button
                type="button"
                onClick={() => setSharing(true)}
                aria-label="Share device"
                title="Invite people and manage access"
                className="inline-flex h-11 w-11 sm:w-auto shrink-0 items-center justify-center gap-2 rounded-xl border border-zinc-200 sm:px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800 transition"
              >
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Share</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setCustomizing(true)}
              aria-label="Display settings"
              title="Name, icon, colour, readings and location"
              className="inline-flex h-11 w-11 sm:w-auto shrink-0 items-center justify-center gap-2 rounded-xl border border-zinc-200 sm:px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800 transition"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">Customise</span>
            </button>
            <button
              type="button"
              onClick={loadDeviceOnce}
              aria-label="Refresh now"
              title="Refresh now (updates every 5 s)"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800 transition"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            </div>
          </div>
        </div>

        {msg && (
          <div
            role="status"
            className={
              "mt-4 rounded-xl border px-3 py-2.5 text-sm " +
              (msgTone === "red"
                ? "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300"
                : msgTone === "amber"
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300"
                  : "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300")
            }
          >
            {msgText}
          </div>
        )}
      </section>

      {/* Actuators */}
      {actuatorCount > 0 && (
        <Card
          title="Controls"
          right={<span className="text-xs text-zinc-500 dark:text-zinc-400">{actuatorCount} actuator{actuatorCount > 1 ? "s" : ""}</span>}
        >
          <div className="grid gap-3 md:grid-cols-2">
            {meta.actuatorEntries.map(({ key: actKey, title }) => {
              const act = meta.controlActuators[actKey];
              const type = act?.type || meta.cfgActuators?.[actKey]?.type;
              const auto = getActAuto(act);
              const liveState = getActLiveState(actKey, meta.telemetryActuators, act);
              const isOn = String(liveState).toUpperCase() === "ON";
              const rowBusy = busyAct === actKey;

              return (
                <div
                  key={actKey}
                  className="relative overflow-hidden rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/30"
                >
                  {rowBusy && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 dark:bg-zinc-950/60" aria-live="polite">
                      <LoadingSignal size="sm" />
                      <span className="sr-only">Sending command…</span>
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-zinc-900 dark:text-white">{title}</div>
                      <div className="text-xs text-zinc-500">{type ? `${type} · ` : ""}<span className="font-mono">{actKey}</span></div>
                    </div>
                    <StateBadge state={liveState} />
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    {/* Mode */}
                    <div role="radiogroup" aria-label={`${actKey} mode`} className="inline-flex rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
                      {[
                        { label: "Auto", value: true },
                        { label: "Manual", value: false },
                      ].map((m) => (
                        <button
                          key={m.label}
                          type="button"
                          role="radio"
                          aria-checked={auto === m.value}
                          disabled={rowBusy || !meta.canControl}
                          onClick={() => auto !== m.value && toggleActuatorAuto(actKey)}
                          className={
                            "h-9 min-w-[4.5rem] rounded-md px-3 text-sm font-semibold transition " +
                            (auto === m.value
                              ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-white"
                              : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200")
                          }
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>

                    {/* Power */}
                    <Switch
                      checked={isOn}
                      disabled={rowBusy || auto || !meta.canControl}
                      icon={Power}
                      variant="emerald"
                      ariaLabel={`Turn ${actKey} ${isOn ? "off" : "on"}`}
                      onChange={(checked) => setActuatorState(actKey, checked ? "ON" : "OFF")}
                    />
                  </div>
                  <p className="mt-2 min-h-4 text-xs text-zinc-500 dark:text-zinc-400">
                    {!meta.canControl ? (
                      <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" aria-hidden /> View only: you&apos;re a {ROLE_LABELS[meta.role]}</span>
                    ) : auto ? "Controlled by schedules and automations" : "You control this actuator"}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Sensors */}
      <Card title="Latest readings">
        <SensorsGrid lastTelemetry={device?.last_telemetry} ui={meta.ui} />
      </Card>

      {/* Graphs */}
      <Card title="History">
        <TelemetryGraph deviceId={meta.id} />
      </Card>

      {meta.canManage && <DeviceActivity deviceId={meta.id} />}

      <DeviceSharingModal deviceId={meta.id} deviceName={meta.name} open={sharing} onClose={() => setSharing(false)} />

      <DeviceCustomizeModal
        device={device}
        open={customizing}
        onClose={() => setCustomizing(false)}
        onSaved={(ui) => {
          setDevice((prev) => (prev ? { ...prev, ui } : prev));
          setMsg("✅ Display settings saved.");
        }}
      />
    </div>
  );
}
