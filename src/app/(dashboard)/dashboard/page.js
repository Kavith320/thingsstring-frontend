"use client";

import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";

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

function StatusPill({ online }) {
  return (
    <span
      className={[
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold border",
        online
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          : "border-white/15 bg-white/5 text-gray-200",
      ].join(" ")}
    >
      <span
        className={[
          "h-2 w-2 rounded-full",
          online ? "bg-emerald-400" : "bg-gray-400",
        ].join(" ")}
      />
      {online ? "ONLINE" : "OFFLINE"}
    </span>
  );
}

function formatLastSeen(ms) {
  if (!ms) return "No telemetry yet";
  const d = new Date(ms);
  return d.toLocaleString();
}

export default function DevicesPage() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

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
    const mapped = (devices || []).map((d) => {
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

    const q = query.trim().toLowerCase();
    if (!q) return mapped;

    return mapped.filter(
      (r) =>
        r.name.toLowerCase().includes(q) || String(r.id).toLowerCase().includes(q)
    );
  }, [devices, query]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">Devices</h2>
          <p className="text-sm text-gray-400 mt-1">
            Status updates every 10s. Offline if last telemetry is older than 60s.
          </p>
        </div>

        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search devices…"
            className="w-full sm:w-64 rounded-2xl border border-white/10 bg-black/30 px-4 py-2 text-sm text-white placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-white/10"
          />
          <button
            onClick={loadDevices}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-200 hover:bg-white/10"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* States */}
      {loading && <div className="text-sm text-gray-400">Loading…</div>}

      {error && (
        <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-8 text-center backdrop-blur-xl">
          <p className="text-white font-semibold">No devices found</p>
          <p className="mt-1 text-sm text-gray-400">
            Try clearing the search, or add a new device.
          </p>
        </div>
      )}

      {/* Grid cards */}
      {!loading && !error && rows.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <a
              key={r.id}
              href={`/devices/${encodeURIComponent(r.id)}`}
              className="
                group relative overflow-hidden
                rounded-3xl border border-white/10
                bg-white/[0.05] p-5
                backdrop-blur-xl
                shadow-[0_20px_70px_rgba(0,0,0,0.55)]
                transition
                hover:border-white/20 hover:bg-white/[0.07]
              "
            >
              {/* subtle shine */}
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.14),transparent_45%)] opacity-80" />

              <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-white">
                    {r.name}
                  </p>
                  <p className="mt-1 truncate text-xs text-gray-400">
                    ID: {r.id}
                  </p>
                </div>

                <StatusPill online={r.online} />
              </div>

              <div className="relative mt-4 rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
                <p className="text-xs text-gray-400">Last Seen</p>
                <p className="mt-1 text-sm text-gray-200">
                  {formatLastSeen(r.lastSeenMs)}
                </p>
              </div>

              <div className="relative mt-4 flex items-center justify-between text-sm">
                <span className="text-gray-400">Open device</span>
                <span className="text-gray-200 group-hover:translate-x-0.5 transition">
                  →
                </span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
