"use client";

import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../../lib/api";

/* -------- Mongo ObjectId -> timestamp helpers -------- */
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

function isOnlineFromLastTelemetry(lastTelemetry, maxAgeMs = 60_000) {
  const ms = getLastTelemetryMs(lastTelemetry);
  if (!ms) return false;
  return Date.now() - ms <= maxAgeMs;
}

function StatusBadge({ online }) {
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

/* -------- UI cards -------- */
function Panel({ title, subtitle, right, children }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="min-w-0">
          <div className="font-semibold">{title}</div>
          {subtitle ? (
            <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {subtitle}
            </div>
          ) : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function SensorCard({ name, avg, min, max, count }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">{name}</div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Devices: {count}
          </div>
        </div>

        <div className="text-right">
          <div className="text-lg font-semibold leading-none">
            {Number.isFinite(avg) ? avg : "-"}
          </div>
          <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            min {Number.isFinite(min) ? min : "-"} • max{" "}
            {Number.isFinite(max) ? max : "-"}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DevicesPage() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadDevices() {
    setError("");
    try {
      const data = await apiRequest("/api/devices", { method: "GET" });
      const list = Array.isArray(data) ? data : data?.devices || [];
      setDevices(list);
    } catch (e) {
      setError(e.message || "Failed to load devices");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    loadDevices();
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

      return { id, name, online, lastSeenMs, lastTelemetry: d?.last_telemetry || null };
    });
  }, [devices]);

  /* ✅ Build sensor summary from last_telemetry across devices */
  const sensorCards = useMemo(() => {
    const ignore = new Set([
      "_id",
      "deviceId",
      "id",
      "actuators",
      "topics",
      "config",
      "control",
    ]);

    // stats per key
    const stats = new Map();

    for (const r of rows) {
      const t = r.lastTelemetry || {};
      for (const [k, v] of Object.entries(t)) {
        if (ignore.has(k)) continue;
        if (typeof v !== "number" || !Number.isFinite(v)) continue;

        const s = stats.get(k) || { key: k, sum: 0, count: 0, min: Infinity, max: -Infinity };
        s.sum += v;
        s.count += 1;
        s.min = Math.min(s.min, v);
        s.max = Math.max(s.max, v);
        stats.set(k, s);
      }
    }

    // convert to list
    const list = Array.from(stats.values())
      .map((s) => ({
        name: s.key,
        count: s.count,
        avg: s.count ? Math.round((s.sum / s.count) * 100) / 100 : null,
        min: Number.isFinite(s.min) ? Math.round(s.min * 100) / 100 : null,
        max: Number.isFinite(s.max) ? Math.round(s.max * 100) / 100 : null,
      }))
      .sort((a, b) => b.count - a.count); // most common first

    return list;
  }, [rows]);

  const onlineCount = useMemo(() => rows.filter((r) => r.online).length, [rows]);

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
          onClick={loadDevices}
          className="w-full sm:w-auto rounded-xl border px-3 py-2 text-sm border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Refresh
        </button>
      </div>

      {loading && <div className="text-sm text-zinc-500">Loading…</div>}

      {error && (
        <div className="rounded-2xl border p-4 border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* ✅ Sensors overview (top area) */}
      {!loading && !error && (
        <Panel
          title="Sensors Overview"
          subtitle="Latest numeric telemetry across your fleet"
          right={
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Online {onlineCount}/{rows.length}
            </div>
          }
        >
          {sensorCards.length === 0 ? (
            <div className="text-sm text-zinc-500 dark:text-zinc-400">
              No numeric sensors found in last telemetry.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {sensorCards.slice(0, 12).map((s) => (
                <SensorCard
                  key={s.name}
                  name={s.name}
                  avg={s.avg}
                  min={s.min}
                  max={s.max}
                  count={s.count}
                />
              ))}
            </div>
          )}

          {sensorCards.length > 12 ? (
            <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              Showing top 12 sensors by availability.
            </div>
          ) : null}
        </Panel>
      )}

      {/* Empty state */}
      {!loading && !error && rows.length === 0 && (
        <div className="rounded-2xl border p-6 border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/60">
          No devices found.
        </div>
      )}

      {/* Device cards */}
      {!loading && !error && rows.length > 0 && (
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
                      <> • Last: {new Date(r.lastSeenMs).toLocaleString()}</>
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
