/**
 * Per-user device display settings from the backend (`ui` on device responses,
 * PATCH /api/devices/:id/ui). See backend PERSONALISATION_FRONTEND_GUIDE.md §3.
 */
import { humanizeKey, isOnlineFromLastTelemetry } from "@/lib/utils";

export interface UiEntry {
    key: string;
    label: string | null;
    unit?: string | null;
    icon: string | null;
    color: string | null;
    visible: boolean;
    pinned: boolean;
}

export interface DeviceLocation {
    lat: number;
    lng: number;
    label?: string | null;
    address?: string | null;
}

export interface DeviceUi {
    displayName: string | null;
    description: string | null;
    icon: string | null;
    color: string | null;
    sensors: UiEntry[];
    actuators: UiEntry[];
    location: DeviceLocation | null;
    updatedAt?: string | null;
}

export const EMPTY_UI: DeviceUi = {
    displayName: null, description: null, icon: null, color: null, sensors: [], actuators: [], location: null,
};

export function deviceUi(d: any): DeviceUi {
    return { ...EMPTY_UI, ...(d?.ui || {}) };
}

export function deviceId(d: any): string {
    return d?.deviceId || d?.config?.device?.device_id || d?._id || "";
}

export function deviceDisplayName(d: any): string {
    return d?.ui?.displayName || d?.config?.device?.name || d?.name || deviceId(d) || "Device";
}

/** Prefer the server's status (same rule the automation engine uses) when present. */
export function deviceOnline(d: any): boolean {
    if (typeof d?.status?.online === "boolean") return d.status.online;
    return isOnlineFromLastTelemetry(d?.last_telemetry);
}

/** Read a possibly nested telemetry field ("data.temp"). */
export function getPath(obj: any, path: string): any {
    if (!obj || typeof obj !== "object") return undefined;
    if (path in obj) return obj[path];
    return path.split(".").reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), obj);
}

export interface ArrangedEntry extends UiEntry {
    /** label to show: custom label or a readable version of the key */
    title: string;
    /** true when the user has saved settings for this key */
    customised: boolean;
}

/**
 * Order `available` keys by the user's saved list (saved order = priority), then append keys
 * that aren't customised yet as visible and unpinned. Saved entries for keys the device no
 * longer reports are kept only when `keepMissing` is set (the settings editor needs them).
 */
export function arrangeEntries(available: string[], saved: UiEntry[] | undefined, { keepMissing = false } = {}): ArrangedEntry[] {
    const avail = new Set(available);
    const out: ArrangedEntry[] = [];
    const seen = new Set<string>();
    for (const e of saved || []) {
        if (!e?.key || seen.has(e.key)) continue;
        if (!avail.has(e.key) && !keepMissing) continue;
        seen.add(e.key);
        out.push({
            key: e.key, label: e.label ?? null, unit: e.unit ?? null, icon: e.icon ?? null, color: e.color ?? null,
            visible: e.visible !== false, pinned: e.pinned === true, title: e.label || humanizeKey(e.key), customised: true,
        });
    }
    for (const key of available) {
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ key, label: null, unit: null, icon: null, color: null, visible: true, pinned: false, title: humanizeKey(key), customised: false });
    }
    return out;
}

/** Strip the display-only fields before sending entries back to the API. */
export function toUiEntries(entries: ArrangedEntry[], kind: "sensors" | "actuators"): UiEntry[] {
    return entries.map((e) => {
        const base: any = { key: e.key, label: e.label || null, icon: e.icon || null, color: e.color || null, visible: e.visible, pinned: e.pinned };
        if (kind === "sensors") base.unit = e.unit || null;
        return base;
    });
}

/** Telemetry fields that are bookkeeping, not readings (same list the readings grid uses). */
export const SENSOR_IGNORE_KEYS = new Set([
    "_id", "id", "uid", "uuid", "deviceId", "device_id", "chipId", "chip_id", "__v", "ts", "timestamp",
    "createdAt", "updatedAt", "time", "date", "meta", "raw", "up", "actuators",
]);

const isScalar = (v: any) => v == null || ["string", "number", "boolean"].includes(typeof v);

/**
 * Reading keys in a telemetry document: top-level scalar fields, plus one level of nested
 * objects as dotted paths ("data.temp"), which is how the backend refers to them.
 */
export function sensorKeys(t: any): string[] {
    if (!t || typeof t !== "object") return [];
    const keys: string[] = [];
    for (const [k, v] of Object.entries(t)) {
        if (SENSOR_IGNORE_KEYS.has(k)) continue;
        if (isScalar(v)) keys.push(k);
        else if (v && typeof v === "object" && !Array.isArray(v)) {
            for (const [k2, v2] of Object.entries(v)) if (isScalar(v2)) keys.push(`${k}.${k2}`);
        }
    }
    return keys.sort();
}

/** Actuator keys a device has (control state, then config). */
export function actuatorKeys(d: any): string[] {
    return [...new Set([...Object.keys(d?.control?.actuators || {}), ...Object.keys(d?.config?.actuators || {})])];
}
