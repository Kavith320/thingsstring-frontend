"use client";

/**
 * Dashboard grid layout: card order, size and visibility, plus the column count.
 * Stored as-is by the backend (PUT/GET /api/dashboard, up to 256 KB) and mirrored in
 * localStorage, so it loads instantly and still works on servers without that endpoint.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/api";

export type CardSize = "s" | "m" | "l";

export interface DashboardLayout {
    version: 1;
    /** columns on wide screens (phones always use 2 half-width slots) */
    columns: 1 | 2 | 3 | 4;
    cards: Record<string, { size?: CardSize; hidden?: boolean }>;
    /** device order per section: a group id, or "ungrouped" */
    order: Record<string, string[]>;
}

export const DEFAULT_LAYOUT: DashboardLayout = { version: 1, columns: 3, cards: {}, order: {} };

const LOCAL_KEY = "ts_dashboard_layout";

function normalise(raw: any): DashboardLayout {
    if (!raw || typeof raw !== "object" || raw.version !== 1) return DEFAULT_LAYOUT;
    const columns = [1, 2, 3, 4].includes(raw.columns) ? raw.columns : 3;
    return {
        version: 1,
        columns,
        cards: raw.cards && typeof raw.cards === "object" ? raw.cards : {},
        order: raw.order && typeof raw.order === "object" ? raw.order : {},
    };
}

function readLocal(): DashboardLayout | null {
    try {
        const s = localStorage.getItem(LOCAL_KEY);
        return s ? normalise(JSON.parse(s)) : null;
    } catch {
        return null;
    }
}

function writeLocal(l: DashboardLayout) {
    try {
        localStorage.setItem(LOCAL_KEY, JSON.stringify(l));
    } catch {
        // storage full / blocked: the server copy still works
    }
}

export function useDashboardLayout() {
    const [layout, setLayout] = useState<DashboardLayout>(DEFAULT_LAYOUT);
    const [serverSupported, setServerSupported] = useState(true);
    const loaded = useRef(false);

    useEffect(() => {
        if (loaded.current) return;
        loaded.current = true;
        const local = readLocal();
        // Browser storage is only readable after hydration, so this sync can't happen during render
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (local) setLayout(local);
        apiRequest("/api/dashboard", { quiet: true })
            .then((r: any) => {
                if (r?.layout) {
                    const l = normalise(r.layout);
                    setLayout(l);
                    writeLocal(l);
                }
            })
            .catch((e) => {
                if (/not found/i.test(e?.message || "")) setServerSupported(false);
            });
    }, []);

    /** Save a new layout. Resolves when stored; rejects with a message if the server refused it. */
    const save = useCallback(
        async (next: DashboardLayout) => {
            setLayout(next);
            writeLocal(next);
            if (!serverSupported) return;
            try {
                await apiRequest("/api/dashboard", { method: "PUT", body: { layout: next } });
            } catch (e: any) {
                if (/not found/i.test(e?.message || "")) {
                    setServerSupported(false); // older backend: keep the browser copy
                    return;
                }
                throw e;
            }
        },
        [serverSupported]
    );

    return { layout, save, serverSupported };
}

/** Apply a saved order to a section's device ids: saved ones first, new devices after. */
export function orderIds(ids: string[], saved: string[] | undefined): string[] {
    if (!saved?.length) return ids;
    const present = new Set(ids);
    const head = saved.filter((id) => present.has(id));
    const inHead = new Set(head);
    return [...head, ...ids.filter((id) => !inHead.has(id))];
}

/** Grid classes for the section grid and a card of a given size. */
export const GRID_COLS: Record<DashboardLayout["columns"], string> = {
    1: "lg:grid-cols-1",
    2: "lg:grid-cols-2",
    3: "lg:grid-cols-3",
    4: "lg:grid-cols-4",
};

export function cardSpan(size: CardSize, columns: DashboardLayout["columns"]): string {
    // Phones: 2 slots (small = half, others full). Tablets: 2 columns. Wide: `columns`.
    if (size === "s") return "col-span-1";
    if (size === "m") return "col-span-2 md:col-span-1";
    return columns >= 2 ? "col-span-2" : "col-span-2 lg:col-span-1";
}
