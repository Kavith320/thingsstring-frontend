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

export function isOnlineFromLastTelemetry(
    lastTelemetry: any,
    maxAgeMs = 60_000
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
