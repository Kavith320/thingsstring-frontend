"use client";

import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../../lib/api";
import { getToken } from "../../../lib/auth";

/* -------- Mongo ObjectId -> timestamp helpers -------- */
function objectIdToMs(oid) {
  if (!oid || typeof oid !== "string" || oid.length < 8) return null;
  const sec = parseInt(oid.slice(0, 8), 16);
  if (!Number.isFinite(sec)) return null;
  return sec * 1000;
}

function getLastTelemetryMs(lastTelemetry) {
  if (!lastTelemetry) return null;

  // If API ever adds explicit timestamps, support them too
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

  // ✅ Your current API: use last_telemetry._id (ObjectId timestamp)
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
        "text-xs px-2 py-1 rounded-full border",
        online
          ? "bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400"
          : "bg-zinc-500/10 border-zinc-500/30 text-zinc-700 dark:text-zinc-200",
      ].join(" ")}
    >
      {online ? "ONLINE" : "OFFLINE"}
    </span>
  );
}

export default function DevicesPage() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadDevices() {
    setError("");
    try {
      const token = getToken();
      const data = await apiRequest("/api/devices", { token });

      // supports: { ok, devices: [...] } OR [...]
      const list = Array.isArray(data) ? data : data?.devices || [];
      setDevices(list);
    } catch (e) {
      setError(e.message || "Failed to load devices");
    } finally {
      setLoading(false);
    }
  }

  // Poll every 10s to update statuses
  useEffect(() => {
    setLoading(true);
    loadDevices();
    const id = setInterval(loadDevices, 10_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      return { id, name, online, lastSeenMs };
    });
  }, [devices]);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Devices</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Name / ID / Status (offline if last telemetry older than 60 seconds)
          </p>
        </div>

        <button
          onClick={loadDevices}
          className="rounded-xl border px-3 py-2 text-sm border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
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

      {!loading && !error && rows.length === 0 && (
        <div className="rounded-2xl border p-6 border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/60">
          No devices found.
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="grid gap-3">
          {rows.map((r) => (
            <div
              key={r.id}
              className="rounded-2xl border p-4 border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/60 flex items-center justify-between"
            >
              <div>
                <div className="font-semibold">{r.name}</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 break-all">
                  ID: {r.id}
                  {r.lastSeenMs ? (
                    <>
                      {" "}
                      • Last: {new Date(r.lastSeenMs).toLocaleString()}
                    </>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <StatusBadge online={r.online} />
                <a
                  href={`/devices/${encodeURIComponent(r.id)}`}
                  className="text-sm underline underline-offset-4"
                >
                  Open
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
