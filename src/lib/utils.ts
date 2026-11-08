import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/* -------- Mongo ObjectId -> timestamp helpers -------- */
export function objectIdToMs(oid: string | undefined | null): number | null {
    if (!oid || typeof oid !== "string" || oid.length < 8) return null;
    const sec = parseInt(oid.slice(0, 8), 16);
    if (!Number.isFinite(sec)) return null;
    return sec * 1000;
}

export function getLastTelemetryMs(lastTelemetry: any): number | null {
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

/**
 * A device is ONLINE if its last telemetry is newer than this.
 * Must match the backend's DEVICE_OFFLINE_THRESHOLD_SEC (default 300s), which decides
 * whether automations and schedules run, so the UI and the engine agree.
 */
export const DEVICE_OFFLINE_MS = 300_000;

export function isOnlineFromLastTelemetry(
    lastTelemetry: any,
    maxAgeMs = DEVICE_OFFLINE_MS
): boolean {
    const ms = getLastTelemetryMs(lastTelemetry);
    if (!ms) return false;
    return Date.now() - ms <= maxAgeMs;
}

export function formatLastSeen(ms: number | null | undefined): string {
    if (!ms) return "No telemetry yet";
    const secAgo = Math.floor((Date.now() - ms) / 1000);

    if (secAgo < 1) return "Just now";
    if (secAgo < 60) return `${secAgo}s ago`;

    const minAgo = Math.floor(secAgo / 60);
    if (minAgo < 60) return `${minAgo}m ago`;

    const hoursAgo = Math.floor(minAgo / 60);
    if (hoursAgo < 24) return `${hoursAgo}h ago`;

    const daysAgo = Math.floor(hoursAgo / 24);
    return `${daysAgo}d ago`;
}

/* -------- Actuator auto/manual mode (mirrors backend services/deviceState.isAutoMode) -------- */
export function isActuatorAuto(actuator: any): boolean {
    if (!actuator || typeof actuator !== "object") return false;
    if (typeof actuator.auto === "boolean") return actuator.auto;
    return actuator.default?.auto === true;
}

/**
 * Manual control (device page, AI assistant) is only allowed in MANUAL mode;
 * in AUTO mode the actuator belongs to schedules and automations.
 * Returns a user-facing reason when control is blocked, otherwise null.
 */
export function manualControlBlockReason(devices: any[], deviceId: string, actuatorKey: string): string | null {
    const device = (devices || []).find(
        (d: any) => d?.deviceId === deviceId || d?.config?._id === deviceId
    );
    if (!device) return `Device '${deviceId}' not found.`;
    const actuator = device.control?.actuators?.[actuatorKey];
    if (isActuatorAuto(actuator)) {
        return `'${actuatorKey}' is in AUTO mode (controlled by schedules/automations). Switch it to MANUAL on the device page first.`;
    }
    return null;
}

const ACRONYMS = new Set(["rssi", "ph", "uv", "led", "tds", "ec", "ppm", "voc", "id", "ac", "dc", "pir", "ldr", "npk"]);

/** "soil_moisture" / "soilMoisture" -> "Soil moisture"; codes stay upper case ("CO2", "RSSI"). */
export function humanizeKey(key: string): string {
    const words = String(key)
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/[_\-.]+/g, " ")
        .trim()
        .split(/\s+/);
    const s = words
        .map((w) => (ACRONYMS.has(w.toLowerCase()) || /\d/.test(w) ? w.toUpperCase() : w.toLowerCase()))
        .join(" ");
    return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Normalise the many ways firmware reports an on/off actuator. */
export function toOnOff(v: any): "ON" | "OFF" {
    if (v && typeof v === "object") return toOnOff(v.state ?? v.status ?? v.value);
    const s = String(v ?? "").toUpperCase();
    return s === "ON" || s === "1" || s === "TRUE" || s === "HIGH" ? "ON" : "OFF";
}
