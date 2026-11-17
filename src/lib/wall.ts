"use client";

/**
 * Wall display: a full-screen, read-only dashboard for a big screen, opened through a
 * public link. Backend WALL_FRONTEND_GUIDE.md. Shared by the editor (/wall) and the screen (/w).
 */
import { humanizeKey } from "@/lib/utils";
import { DEFAULT_NATURAL_VOICE, naturalVoiceSupported, setVoiceAudioContext, speakNatural } from "@/lib/naturalVoice";

/* ─────────────────────────────── Types ─────────────────────────────── */

export type TileType = "sensor" | "actuator" | "status" | "clock" | "text" | "graph" | "image";
export type TileSize = "s" | "m" | "l" | "t";
export type SensorStyle = "number" | "gauge" | "chart";
export type Level = "ok" | "warn" | "critical";

export interface Range {
    below?: number | null;
    above?: number | null;
}

export type IconSize = "sm" | "md" | "lg";
export type GraphKind = "line" | "area" | "bar";
export const GRAPH_RANGES: { h: number; label: string }[] = [
    { h: 1, label: "1 hour" },
    { h: 6, label: "6 hours" },
    { h: 24, label: "24 hours" },
    { h: 72, label: "3 days" },
    { h: 168, label: "7 days" },
];

/** One line of a graph tile. Owner side has deviceId + key; the screen gets id + dev. */
export interface GraphSeries {
    deviceId?: string;
    key?: string;
    label?: string | null;
    unit?: string | null;
    color?: string | null;
    /** screen side: history id ("<tile>.<n>") and device alias */
    id?: string;
    dev?: string;
}

/** A named frame on a page; the tiles inside its area belong to it. */
export interface WallGroup {
    id: string;
    label?: string | null;
    icon?: string | null;
    color?: string | null;
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface WallTile {
    id: string;
    type: TileType;
    /** owner side only; the screen gets `dev` (an alias) instead */
    deviceId?: string;
    key?: string;
    label?: string | null;
    unit?: string | null;
    icon?: string | null;
    color?: string | null;
    /** tile background colour (hex); text switches to dark or light to stay readable */
    bg?: string | null;
    /** sm: small icon by the label; md / lg: a big icon next to the value */
    iconSize?: IconSize;
    /** legacy size: only used to place a tile that has no position yet */
    size: TileSize;
    /** position on the canvas grid, in cells */
    x?: number;
    y?: number;
    w?: number;
    h?: number;
    style?: SensorStyle;
    decimals?: number | null;
    min?: number | null;
    max?: number | null;
    warn?: Range | null;
    critical?: Range | null;
    announce?: boolean;
    text?: string | null;
    /** graph */
    series?: GraphSeries[];
    rangeH?: number;
    chart?: GraphKind;
    /** image: "file:<id>" */
    image?: string | null;
    fit?: "cover" | "contain";
    dev?: string;
    unavailable?: boolean;
}

export interface WallPage {
    id: string;
    title?: string | null;
    tiles: WallTile[];
    groups?: WallGroup[];
}

/** The screen a wall is designed for, split into cols × rows cells that tiles snap to. */
export interface WallCanvas {
    width: number;
    height: number;
    cols: number;
    rows: number;
}

export interface WallDisplay {
    theme: "auto" | "light" | "dark";
    accent: string | null;
    /** old setting, replaced by canvas */
    columns: number;
    canvas: WallCanvas;
    /** how long a pop-up notification stays */
    notifySec: number;
    textScale: number;
    rotateSec: number;
    showClock: boolean;
    showFeed: boolean;
    highlightSec: number;
    burnInShift: boolean;
    sound: { enabled: boolean; on: "all" | "alerts"; tone: "chime" | "beep" | "soft"; volume: number };
    voice: {
        enabled: boolean;
        on: "all" | "alerts";
        /** "natural": built-in neural voice (same on every screen); "browser": the screen's own voices */
        engine: "natural" | "browser";
        naturalVoice: string;
        volume: number;
        rate: number;
        pitch: number;
        lang: string | null;
        voiceName: string | null;
    };
    quietHours: { enabled: boolean; from: string; to: string };
}

export interface WallConfig {
    title: string;
    display: WallDisplay;
    pages: WallPage[];
}

export interface WallDevice {
    name: string;
    online: boolean;
    lastSeen: string | null;
}

export type ActuatorValue = { on: boolean; auto: boolean };
export type TileValue = number | string | boolean | ActuatorValue | null | undefined;

export interface WallData {
    wall: WallConfig;
    devices: Record<string, WallDevice>;
    values: Record<string, TileValue>;
    history: Record<string, [number, number][]>;
    offlineAfterSec?: number;
    serverTime?: string;
}

export interface WallUpdate {
    values: Record<string, TileValue>;
    devices: Record<string, WallDevice>;
    points: Record<string, [number, number]>;
    at: string;
}

export interface FeedEvent {
    id: string;
    at: number;
    tileId?: string;
    level: "info" | Level;
    kind: "actuator" | "level" | "status";
    text: string;
    speech: string;
    /** play a sound / speak it (the tile has announcements on) */
    announce: boolean;
}

/* ─────────────────────────────── Defaults ─────────────────────────────── */

export const DEFAULT_DISPLAY: WallDisplay = {
    theme: "dark",
    accent: null,
    columns: 4,
    canvas: { width: 1920, height: 1080, cols: 12, rows: 6 },
    notifySec: 8,
    textScale: 1,
    rotateSec: 0,
    showClock: true,
    showFeed: true,
    highlightSec: 6,
    burnInShift: true,
    sound: { enabled: true, on: "all", tone: "chime", volume: 0.6 },
    voice: { enabled: true, on: "all", engine: "natural", naturalVoice: DEFAULT_NATURAL_VOICE, volume: 1, rate: 1, pitch: 1, lang: null, voiceName: null },
    quietHours: { enabled: false, from: "22:00", to: "06:00" },
};

export function normaliseDisplay(d: any): WallDisplay {
    const x = d && typeof d === "object" ? d : {};
    return {
        ...DEFAULT_DISPLAY,
        ...x,
        canvas: { ...DEFAULT_DISPLAY.canvas, ...(x.canvas || {}) },
        sound: { ...DEFAULT_DISPLAY.sound, ...(x.sound || {}) },
        voice: { ...DEFAULT_DISPLAY.voice, ...(x.voice || {}) },
        quietHours: { ...DEFAULT_DISPLAY.quietHours, ...(x.quietHours || {}) },
    };
}

/* ─────────────────────────────── Layout ─────────────────────────────── */

export const RESOLUTIONS: { id: string; label: string; width: number; height: number }[] = [
    { id: "1920x1080", label: "Full HD TV · 1920 × 1080", width: 1920, height: 1080 },
    { id: "3840x2160", label: "4K TV · 3840 × 2160", width: 3840, height: 2160 },
    { id: "1280x720", label: "HD TV · 1280 × 720", width: 1280, height: 720 },
    { id: "1366x768", label: "Laptop · 1366 × 768", width: 1366, height: 768 },
    { id: "2560x1440", label: "Monitor QHD · 2560 × 1440", width: 2560, height: 1440 },
    { id: "1920x1200", label: "Monitor 16:10 · 1920 × 1200", width: 1920, height: 1200 },
    { id: "3440x1440", label: "Ultrawide · 3440 × 1440", width: 3440, height: 1440 },
    { id: "1024x768", label: "Tablet 4:3 · 1024 × 768", width: 1024, height: 768 },
    { id: "1080x1920", label: "Portrait TV · 1080 × 1920", width: 1080, height: 1920 },
];

/**
 * Everything is drawn on a "stage" whose shorter side is always 1080 units, with the
 * canvas' shape; the screen then scales the stage to fit. So a 4K TV and a 720p TV show
 * the same layout at the same proportions, and text sizes are tuned once.
 */
export const STAGE_BASE = 1080;
export const STAGE = { pad: 28, gap: 16, header: 84 };

export function stageSize(c: WallCanvas): { w: number; h: number } {
    const k = STAGE_BASE / Math.max(1, Math.min(c.width, c.height));
    return { w: Math.round(c.width * k), h: Math.round(c.height * k) };
}

/** Rows that keep cells about square for these columns. */
export function autoRows(c: Pick<WallCanvas, "width" | "height" | "cols">): number {
    const s = stageSize({ ...c, rows: 1 });
    const cw = (s.w - STAGE.pad * 2) / c.cols;
    return Math.max(2, Math.min(24, Math.round((s.h - STAGE.pad * 2 - STAGE.header) / cw)));
}

export interface Geometry {
    left: number;
    top: number;
    cw: number;
    ch: number;
    gap: number;
}

export function geometry(stage: { w: number; h: number }, cols: number, rows: number, pad = STAGE.pad, header = STAGE.header, gap = STAGE.gap): Geometry {
    const top = pad + header;
    return { left: pad, top, gap, cw: (stage.w - pad * 2 - gap * (cols - 1)) / cols, ch: (stage.h - top - pad - gap * (rows - 1)) / rows };
}

export interface Cell {
    x: number;
    y: number;
    w: number;
    h: number;
}

export function cellRect(g: Geometry, c: Cell) {
    return { left: g.left + c.x * (g.cw + g.gap), top: g.top + c.y * (g.ch + g.gap), width: c.w * g.cw + (c.w - 1) * g.gap, height: c.h * g.ch + (c.h - 1) * g.gap };
}

export type Placed = WallTile & Cell;

const SIZE_CELLS: Record<TileSize, [number, number]> = { s: [1, 1], m: [2, 1], l: [2, 2], t: [1, 2] };

/** Size for a tile that has none yet: its old size, in about sixths of the canvas. */
export function defaultSpan(t: Pick<WallTile, "size" | "type" | "style">, cols: number, rows: number): { w: number; h: number } {
    const [a, b] = SIZE_CELLS[t.size] || SIZE_CELLS.s;
    const u = Math.max(1, Math.round(cols / 6));
    const v = Math.max(1, Math.round(rows / 3));
    return { w: Math.min(cols, a * u), h: Math.min(rows, b * v) };
}

export function overlaps(a: Cell, b: Cell): boolean {
    return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

export function contains(outer: Cell, inner: Cell): boolean {
    return inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;
}

/** A tile may sit fully inside a group or fully outside it, never across its edge. */
export function crossesGroup(c: Cell, groups: Cell[] = []): boolean {
    return groups.some((g) => overlaps(g, c) && !contains(g, c));
}

/** The group a tile sits in, if any. */
export function groupOf<G extends Cell>(c: Cell, groups: G[] = []): G | undefined {
    return groups.find((g) => contains(g, c));
}

/** First free spot for a w × h tile, left to right, top to bottom. */
export function findSpot(taken: Cell[], w: number, h: number, cols: number, rows: number, groups: Cell[] = []): Cell | null {
    for (let y = 0; y + h <= rows; y++) {
        for (let x = 0; x + w <= cols; x++) {
            const c = { x, y, w, h };
            if (!taken.some((t) => overlaps(t, c)) && !crossesGroup(c, groups)) return c;
        }
    }
    return null;
}

/**
 * Where every tile goes. Tiles keep their own position when it is inside the canvas and
 * free; the rest (old walls, a smaller grid) go to the first free spot, shrinking if they
 * must. Tiles that can't fit at all are returned as `overflow`. Same result on every screen.
 */
export function layoutTiles(tiles: WallTile[], cols: number, rows: number, groups: Cell[] = []): { placed: Placed[]; overflow: WallTile[] } {
    const taken: Cell[] = [];
    const pos = new Map<string, Cell>();
    const ok = (n: unknown) => Number.isInteger(n);
    for (const t of tiles) {
        if (!ok(t.x) || !ok(t.y) || !ok(t.w) || !ok(t.h)) continue;
        const c = { x: t.x!, y: t.y!, w: t.w!, h: t.h! };
        if (c.w < 1 || c.h < 1 || c.x < 0 || c.y < 0 || c.x + c.w > cols || c.y + c.h > rows) continue;
        if (taken.some((x) => overlaps(x, c))) continue;
        taken.push(c);
        pos.set(t.id, c);
    }
    const overflow: WallTile[] = [];
    for (const t of tiles) {
        if (pos.has(t.id)) continue;
        const want = ok(t.w) && ok(t.h) ? { w: Math.min(cols, Math.max(1, t.w!)), h: Math.min(rows, Math.max(1, t.h!)) } : defaultSpan(t, cols, rows);
        let c: Cell | null = null;
        for (let w = want.w, h = want.h; !c && w >= 1 && h >= 1; w > h ? w-- : h--) c = findSpot(taken, w, h, cols, rows, groups);
        if (!c) {
            overflow.push(t);
            continue;
        }
        taken.push(c);
        pos.set(t.id, c);
    }
    return { placed: tiles.filter((t) => pos.has(t.id)).map((t) => ({ ...t, ...pos.get(t.id)! })), overflow };
}

/** Write resolved positions into the tiles (so the saved wall matches what's shown). */
export function withPositions(tiles: WallTile[], cols: number, rows: number, groups: Cell[] = []): WallTile[] {
    const { placed } = layoutTiles(tiles, cols, rows, groups);
    const at = new Map(placed.map((p) => [p.id, p]));
    return tiles.map((t) => {
        const p = at.get(t.id);
        return p ? { ...t, x: p.x, y: p.y, w: p.w, h: p.h } : t;
    });
}

/**
 * Move tiles to a new grid size, then fix any overlaps. "stretch" scales across and down
 * separately (more or fewer rows on the same screen); "keep" scales both the same way so
 * tiles keep their shape (a different screen, e.g. landscape to portrait).
 */
export function regrid(page: WallPage, from: Pick<WallCanvas, "cols" | "rows">, to: Pick<WallCanvas, "cols" | "rows">, mode: "stretch" | "keep" = "stretch"): WallPage {
    let fx = to.cols / from.cols;
    let fy = to.rows / from.rows;
    if (mode === "keep") fx = fy = Math.min(fx, fy);
    const scale = <T extends Partial<Cell>>(t: T): T => {
        if (!Number.isInteger(t.x)) return t;
        const x = Math.min(Math.round(t.x! * fx), to.cols - 1);
        const y = Math.min(Math.round(t.y! * fy), to.rows - 1);
        const w = Math.max(1, Math.min(to.cols - x, Math.round((t.x! + t.w!) * fx) - x));
        const h = Math.max(1, Math.min(to.rows - y, Math.round((t.y! + t.h!) * fy) - y));
        return { ...t, x, y, w, h };
    };
    const groups = (page.groups || []).map(scale);
    return { ...page, groups, tiles: withPositions(page.tiles.map(scale), to.cols, to.rows, groups) };
}

/* ─────────────────────────────── Rectangles ─────────────────────────────── */

export interface Rect {
    left: number;
    top: number;
    width: number;
    height: number;
}

/** Group frame: a header strip, then its tiles a little inset. */
export const GROUP = { head: 60, pad: 14 };

/**
 * Where tiles and group frames are drawn (stage units). Tiles inside a group are fitted
 * into the frame below its header, keeping their arrangement.
 */
export function canvasRects(placed: Placed[], groups: WallGroup[], g: Geometry, k = 1): { items: { t: Placed; r: Rect }[]; frames: { g: WallGroup; r: Rect }[] } {
    const frames = groups.map((x) => ({ g: x, r: cellRect(g, x) }));
    const items = placed.map((t) => {
        const r = cellRect(g, t);
        const f = frames.find((x) => contains(x.g, t));
        if (!f) return { t, r };
        const head = GROUP.head * k;
        const pad = GROUP.pad * k;
        const sx = (f.r.width - pad * 2) / f.r.width;
        const sy = (f.r.height - head - pad) / f.r.height;
        return { t, r: { left: f.r.left + pad + (r.left - f.r.left) * sx, top: f.r.top + head + (r.top - f.r.top) * sy, width: r.width * sx, height: r.height * sy } };
    });
    return { items, frames };
}

/**
 * Phone layout: when the canvas would be too small to read, tiles are stacked two to a
 * row in reading order instead (wide tiles take the full row).
 */
export const FLOW = { width: 440, cols: 2, row: 150, pad: 14, gap: 12, header: 64 };

export function flowLayout(placed: Placed[], groups: WallGroup[], cols: number): { items: { t: Placed; r: Rect }[]; frames: { g: WallGroup; r: Rect }[]; height: number } {
    const cw = (FLOW.width - FLOW.pad * 2 - FLOW.gap) / FLOW.cols;
    const items: { t: Placed; r: Rect }[] = [];
    const frames: { g: WallGroup; r: Rect }[] = [];
    const byPos = (a: Cell, b: Cell) => a.y - b.y || a.x - b.x;
    // Sections in reading order: each group with its tiles, and runs of loose tiles
    const entries: { at: Cell; group?: WallGroup; tile?: Placed }[] = [
        ...groups.map((g) => ({ at: g, group: g })),
        ...placed.filter((t) => !groupOf(t, groups)).map((t) => ({ at: t as Cell, tile: t })),
    ].sort((a, b) => byPos(a.at, b.at));
    const sections: { group?: WallGroup; tiles: Placed[] }[] = [];
    for (const e of entries) {
        if (e.group) sections.push({ group: e.group, tiles: placed.filter((t) => contains(e.group!, t)).sort(byPos) });
        else if (sections.length && !sections[sections.length - 1].group) sections[sections.length - 1].tiles.push(e.tile!);
        else sections.push({ tiles: [e.tile!] });
    }
    let y = FLOW.pad + FLOW.header;
    for (const sec of sections) {
        const k = 0.7;
        const head = sec.group ? GROUP.head * k : 0;
        const pad = sec.group ? GROUP.pad * k : 0;
        const inner = FLOW.width - FLOW.pad * 2 - pad * 2;
        const icw = sec.group ? (inner - FLOW.gap) / 2 : cw;
        const taken: Cell[] = [];
        for (const t of sec.tiles) {
            // A third of the canvas or wider takes the full row; tall or big tiles get two rows
            const w = t.w * 3 >= cols ? 2 : 1;
            const h = t.h / t.w >= (w === 2 ? 0.75 : 1.5) ? 2 : 1;
            const c = findSpot(taken, w, h, FLOW.cols, 999)!;
            taken.push(c);
            items.push({
                t,
                r: { left: FLOW.pad + pad + c.x * (icw + FLOW.gap), top: y + head + c.y * (FLOW.row + FLOW.gap), width: c.w * icw + (c.w - 1) * FLOW.gap, height: c.h * FLOW.row + (c.h - 1) * FLOW.gap },
            });
        }
        const rowsUsed = taken.length ? Math.max(...taken.map((c) => c.y + c.h)) : 0;
        const body = rowsUsed ? rowsUsed * (FLOW.row + FLOW.gap) - FLOW.gap : 0;
        if (sec.group) frames.push({ g: sec.group, r: { left: FLOW.pad, top: y, width: FLOW.width - FLOW.pad * 2, height: head + body + pad } });
        y += head + body + pad + FLOW.gap;
    }
    return { items, frames, height: y - FLOW.gap + FLOW.pad };
}

export function newId(prefix = "t"): string {
    const a = new Uint8Array(6);
    crypto.getRandomValues(a);
    return prefix + Array.from(a, (b) => (b % 36).toString(36)).join("");
}

/* ─────────────────────────────── Values ─────────────────────────────── */

export function isActuatorValue(v: TileValue): v is ActuatorValue {
    return !!v && typeof v === "object" && "on" in v;
}

export function tileLabel(t: WallTile): string {
    if (t.label) return t.label;
    if (t.type === "clock") return "Clock";
    if (t.type === "text") return "Note";
    if (t.type === "status") return "Device status";
    if (t.type === "graph") return t.series?.length === 1 && t.series[0].label ? t.series[0].label : "Graph";
    if (t.type === "image") return "Picture";
    return t.key ? humanizeKey(t.key.split(".").pop() || t.key) : "Tile";
}

function inRange(v: number, r?: Range | null): boolean {
    if (!r) return false;
    return (r.below != null && v < r.below) || (r.above != null && v > r.above);
}

/** ok / warn / critical for a sensor reading against the tile's thresholds. */
export function tileLevel(t: WallTile, v: TileValue): Level {
    if (t.type !== "sensor" || typeof v !== "number") return "ok";
    if (inRange(v, t.critical)) return "critical";
    if (inRange(v, t.warn)) return "warn";
    return "ok";
}

export function formatNumber(v: number, decimals?: number | null): string {
    if (decimals != null) return v.toFixed(decimals);
    const abs = Math.abs(v);
    return abs >= 100 ? v.toFixed(0) : abs >= 10 ? (Math.round(v * 10) / 10).toString() : (Math.round(v * 100) / 100).toString();
}

export function formatValue(t: WallTile, v: TileValue): string {
    if (v === null || v === undefined) return "—";
    if (isActuatorValue(v)) return v.on ? "ON" : "OFF";
    if (typeof v === "number") return formatNumber(v, t.decimals);
    if (typeof v === "boolean") return v ? "Yes" : "No";
    return String(v);
}

/** Speakable unit: "°C" -> "degrees", "%" -> "percent". */
function spokenUnit(u?: string | null): string {
    if (!u) return "";
    const map: Record<string, string> = { "°C": "degrees", "°F": "degrees Fahrenheit", "%": "percent", ppm: "parts per million", lx: "lux", hPa: "hectopascals", dBm: "dee bee em" };
    return map[u] ?? u;
}

/* ─────────────────────────────── Change → events ─────────────────────────────── */

let eventSeq = 0;

/**
 * What changed between two states, as feed events: switches turning on/off or between
 * auto and manual, readings crossing a threshold (and recovering), devices going offline
 * and coming back. Plain value changes only highlight the tile (see changedTiles).
 */
export function diffEvents(prev: WallData, next: WallData, now = Date.now()): FeedEvent[] {
    const out: FeedEvent[] = [];
    const devName = (dev?: string) => (dev && next.devices[dev]?.name) || "Device";
    // "Water pump in North greenhouse" (just the label when it already names the device)
    const said = (t: WallTile, label: string) => {
        const d = t.dev ? next.devices[t.dev]?.name : null;
        return d && !label.toLowerCase().includes(d.toLowerCase()) ? `${label} in ${d}` : label;
    };
    const push = (e: Omit<FeedEvent, "id" | "at">) => out.push({ ...e, id: `e${++eventSeq}`, at: now });
    const statusDone = new Set<string>();

    for (const page of next.wall.pages) {
        for (const t of page.tiles) {
            if (t.unavailable) continue;
            const a = prev.values[t.id];
            const b = next.values[t.id];
            const label = tileLabel(t);
            const announce = t.announce !== false;

            if (t.type === "actuator" && isActuatorValue(b) && isActuatorValue(a)) {
                if (a.on !== b.on) {
                    push({ tileId: t.id, kind: "actuator", level: "info", announce, text: `${label} turned ${b.on ? "ON" : "OFF"}`, speech: `${said(t, label)} is now ${b.on ? "on" : "off"}.` });
                } else if (a.auto !== b.auto) {
                    push({ tileId: t.id, kind: "actuator", level: "info", announce, text: `${label} switched to ${b.auto ? "AUTO" : "MANUAL"}`, speech: `${said(t, label)} switched to ${b.auto ? "automatic" : "manual"} mode.` });
                }
            }

            if (t.type === "sensor" && typeof b === "number") {
                const la = tileLevel(t, a);
                const lb = tileLevel(t, b);
                if (la !== lb && a !== undefined && a !== null) {
                    const val = `${formatNumber(b, t.decimals)}${t.unit ? ` ${t.unit}` : ""}`;
                    const spoken = `${formatNumber(b, t.decimals)} ${spokenUnit(t.unit)}`.trim();
                    const range = lb === "critical" ? t.critical : t.warn;
                    const dir = range?.below != null && b < range.below ? "low" : "high";
                    const who = said(t, label);
                    if (lb === "ok") push({ tileId: t.id, kind: "level", level: "ok", announce, text: `${label} back to normal (${val})`, speech: `Good news. ${who} is back to normal, at ${spoken}.` });
                    else
                        push({
                            tileId: t.id,
                            kind: "level",
                            level: lb,
                            announce,
                            text: `${label} ${lb === "critical" ? "critically " : ""}${dir}: ${val}`,
                            speech: lb === "critical" ? `Attention, please. ${who} is critically ${dir}, at ${spoken}.` : `Just so you know, ${who} is getting ${dir}, at ${spoken}.`,
                        });
                }
            }

            if (t.type === "status" && t.dev && !statusDone.has(t.dev)) {
                statusDone.add(t.dev);
                const pa = prev.devices[t.dev];
                const pb = next.devices[t.dev];
                if (pa && pb && pa.online !== pb.online) {
                    const name = devName(t.dev);
                    push(
                        pb.online
                            ? { tileId: t.id, kind: "status", level: "ok", announce, text: `${name} is back online`, speech: `${name} is back online.` }
                            : { tileId: t.id, kind: "status", level: "critical", announce, text: `${name} went offline`, speech: `Attention, please. ${name} has gone offline.` }
                    );
                }
            }
        }
    }
    return out;
}

/** Tile ids whose value (or device status) changed. */
export function changedTiles(prev: WallData, next: WallData): string[] {
    const ids: string[] = [];
    for (const page of next.wall.pages) {
        for (const t of page.tiles) {
            const a = t.type === "status" ? prev.devices[t.dev || ""]?.online : prev.values[t.id];
            const b = t.type === "status" ? next.devices[t.dev || ""]?.online : next.values[t.id];
            if (a !== undefined && JSON.stringify(a) !== JSON.stringify(b)) ids.push(t.id);
        }
    }
    return ids;
}

/** How long a history line covers, and how close points may be (graphs keep ~120 points). */
function historySpan(wall: WallConfig, id: string): { keepMs: number; stepMs: number } {
    const dot = id.indexOf(".");
    if (dot > 0) {
        const tileId = id.slice(0, dot);
        for (const p of wall.pages) {
            const t = p.tiles.find((x) => x.id === tileId);
            if (t?.type === "graph") {
                const keepMs = (t.rangeH || 24) * 3600 * 1000;
                return { keepMs, stepMs: keepMs <= 3600 * 1000 ? 0 : keepMs / 120 };
            }
        }
    }
    return { keepMs: 3600 * 1000, stepMs: 0 };
}

/** Apply a stream update to the current state (immutably). */
export function applyUpdate(cur: WallData, u: WallUpdate): WallData {
    const history = { ...cur.history };
    const now = Date.now();
    for (const [id, p] of Object.entries(u.points || {})) {
        const { keepMs, stepMs } = historySpan(cur.wall, id);
        const line = (history[id] || []).filter(([t]) => t >= now - keepMs);
        const last = line[line.length - 1];
        // Long graphs: a new reading updates the newest point until a step has passed
        if (stepMs && last && p[0] - last[0] < stepMs && line.length > 1) line[line.length - 1] = [last[0], (last[1] + p[1]) / 2];
        else line.push(p);
        history[id] = line.slice(-240);
    }
    return {
        ...cur,
        values: { ...cur.values, ...u.values },
        devices: { ...cur.devices, ...u.devices },
        history,
    };
}

/* ─────────────────────────────── Quiet hours ─────────────────────────────── */

export function inQuietHours(q: WallDisplay["quietHours"], d = new Date()): boolean {
    if (!q.enabled) return false;
    const m = d.getHours() * 60 + d.getMinutes();
    const [fh, fm] = q.from.split(":").map(Number);
    const [th, tm] = q.to.split(":").map(Number);
    const from = fh * 60 + fm;
    const to = th * 60 + tm;
    return from <= to ? m >= from && m < to : m >= from || m < to;
}

/** Should this event make a sound / be spoken under these settings? */
export function wantsAnnounce(e: FeedEvent, on: "all" | "alerts"): boolean {
    if (!e.announce) return false;
    return on === "all" || e.level === "warn" || e.level === "critical";
}

/* ─────────────────────────────── Sound ─────────────────────────────── */

let audioCtx: AudioContext | null = null;

/**
 * Create / resume the audio output. Works straight away where the browser allows sound
 * (kiosk settings, a site the screen has played sound on before); otherwise it starts on
 * the first tap or key press (see startAudioWhenAllowed).
 */
export function unlockAudio(): boolean {
    try {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        if (!Ctx) return false;
        audioCtx = audioCtx || new Ctx();
        if (audioCtx.state === "suspended") void audioCtx.resume();
        setVoiceAudioContext(audioCtx);
        return true;
    } catch {
        return false;
    }
}

export function audioReady(): boolean {
    return !!audioCtx && audioCtx.state === "running";
}

/**
 * Start sound without asking: try now, and if the browser holds it back, start it on the
 * first tap, click or key press anywhere (a TV remote counts). `onChange(true)` once it plays.
 */
export function startAudioWhenAllowed(onChange: (running: boolean) => void): () => void {
    if (typeof window === "undefined") return () => {};
    unlockAudio();
    const ctx = audioCtx;
    const report = () => onChange(audioReady());
    const events = ["pointerdown", "keydown", "touchend", "click"];
    const kick = () => {
        unlockAudio();
        setTimeout(report, 150);
    };
    for (const e of events) window.addEventListener(e, kick, { capture: true, passive: true });
    ctx?.addEventListener?.("statechange", report);
    // resume() never settles while the browser is blocking, so check after a moment
    const t = setTimeout(report, 400);
    report();
    return () => {
        clearTimeout(t);
        for (const e of events) window.removeEventListener(e, kick, { capture: true } as any);
        ctx?.removeEventListener?.("statechange", report);
    };
}

export function playTone(tone: WallDisplay["sound"]["tone"], level: FeedEvent["level"], volume: number) {
    if (!audioCtx) return;
    const ctx = audioCtx;
    const urgent = level === "critical";
    const notes: { f: number; t: number; d: number }[] =
        tone === "beep"
            ? [{ f: urgent ? 1320 : 880, t: 0, d: 0.12 }, ...(urgent ? [{ f: 1320, t: 0.2, d: 0.12 }, { f: 1320, t: 0.4, d: 0.12 }] : [])]
            : tone === "soft"
              ? [{ f: urgent ? 523 : 392, t: 0, d: 0.5 }, ...(urgent ? [{ f: 523, t: 0.6, d: 0.5 }] : [])]
              : urgent
                ? [{ f: 988, t: 0, d: 0.18 }, { f: 784, t: 0.2, d: 0.18 }, { f: 988, t: 0.4, d: 0.18 }, { f: 784, t: 0.6, d: 0.3 }]
                : level === "ok"
                  ? [{ f: 659, t: 0, d: 0.22 }, { f: 880, t: 0.16, d: 0.4 }]
                  : [{ f: 880, t: 0, d: 0.22 }, { f: 659, t: 0.16, d: 0.4 }];
    const wave: OscillatorType = tone === "beep" ? "square" : tone === "soft" ? "triangle" : "sine";
    const peak = Math.max(0, Math.min(1, volume)) * (tone === "beep" ? 0.12 : 0.3);
    const start = ctx.currentTime + 0.02;
    for (const n of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = wave;
        osc.frequency.value = n.f;
        gain.gain.setValueAtTime(0.0001, start + n.t);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + n.t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + n.t + n.d);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start + n.t);
        osc.stop(start + n.t + n.d + 0.05);
    }
}

/* ─────────────────────────────── Voice ─────────────────────────────── */

export function speechSupported(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function listVoices(): SpeechSynthesisVoice[] {
    return speechSupported() ? window.speechSynthesis.getVoices() : [];
}

const NICE_VOICE = /natural|neural|online|premium|enhanced|google|siri/i;
const FEMALE_VOICE = /female|woman|aria|jenny|sonia|libby|emma|ava|samantha|karen|serena|moira|tessa|fiona|victoria|zira|hazel|susan|allison|joanna|kendra|salli|olivia|amy|natasha|clara|michelle|ana\b/i;
const ROBOTIC_VOICE = /espeak|robot|whisper|zarvox|trinoids|bad news|bells|bubbles|cellos|jester|organ|superstar/i;

/** The smoothest female voice the screen has, in the wanted language (English by default). */
export function pickBrowserVoice(voices: SpeechSynthesisVoice[], v: Pick<WallDisplay["voice"], "lang" | "voiceName">): SpeechSynthesisVoice | null {
    if (v.voiceName) {
        const exact = voices.find((x) => x.name === v.voiceName);
        if (exact) return exact;
    }
    const lang = (v.lang || "en").toLowerCase();
    const score = (x: SpeechSynthesisVoice) =>
        (x.lang.toLowerCase().startsWith(lang) ? 100 : x.lang.toLowerCase().startsWith(lang.slice(0, 2)) ? 60 : 0) +
        (NICE_VOICE.test(x.name) ? 30 : 0) +
        (FEMALE_VOICE.test(x.name) ? 20 : 0) +
        (x.localService ? 0 : 5) -
        (ROBOTIC_VOICE.test(x.name) ? 80 : 0);
    return voices.slice().sort((a, b) => score(b) - score(a))[0] || null;
}

/** Speak one line with the screen's own voices. A backlog is dropped so it never talks minutes behind. */
export function speak(text: string, v: WallDisplay["voice"]) {
    if (!speechSupported()) return;
    const synth = window.speechSynthesis;
    if (synth.pending) synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const voice = pickBrowserVoice(synth.getVoices(), v);
    if (voice) {
        u.voice = voice;
        u.lang = voice.lang;
    } else if (v.lang) u.lang = v.lang;
    u.rate = v.rate;
    u.pitch = v.pitch;
    u.volume = v.volume ?? 1;
    synth.speak(u);
}

/**
 * Say something with the configured voice. The natural voice falls back to the screen's
 * own voice when it can't be used (old browser, model can't be downloaded, sound locked).
 */
export function announceVoice(text: string, v: WallDisplay["voice"]): Promise<"natural" | "browser"> {
    if (v.engine === "natural" && naturalVoiceSupported()) {
        return speakNatural(text, v.naturalVoice || DEFAULT_NATURAL_VOICE, v.volume ?? 1).then(
            () => "natural" as const,
            () => {
                speak(text, v);
                return "browser" as const;
            }
        );
    }
    speak(text, v);
    return Promise.resolve("browser");
}

/* ─────────────────────────────── Public API (no login) ─────────────────────────────── */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export class WallApiError extends Error {
    status: number;
    code?: string;
    body: any;
    constructor(message: string, status: number, code?: string, body?: any) {
        super(message);
        this.status = status;
        this.code = code;
        this.body = body;
    }
}

async function publicJson(path: string, init: RequestInit & { session?: string } = {}) {
    const { session, ...rest } = init;
    const res = await fetch(API_URL + path, {
        ...rest,
        cache: "no-store",
        referrerPolicy: "no-referrer",
        headers: { "Content-Type": "application/json", ...(session ? { Authorization: `Wall ${session}` } : {}), ...(rest.headers || {}) },
    });
    let body: any = null;
    try {
        body = await res.json();
    } catch {}
    if (!res.ok) throw new WallApiError(body?.error || `Request failed (${res.status})`, res.status, body?.code, body);
    return body;
}

export function createWallSession(token: string, pin?: string): Promise<{ session: string; expiresAt: string; title: string }> {
    return publicJson("/api/public/wall/session", { method: "POST", body: JSON.stringify({ token, ...(pin ? { pin } : {}) }) });
}

export function fetchWallSnapshot(session: string): Promise<WallData> {
    return publicJson("/api/public/wall/snapshot", { session });
}

export type StreamStatus = "connecting" | "live" | "polling" | "reconnecting";

interface StreamHandlers {
    onSnapshot: (d: WallData) => void;
    onUpdate: (u: WallUpdate) => void;
    onRevoked: (reason: string) => void;
    onAuthError: (e: WallApiError) => void;
    onStatus: (s: StreamStatus) => void;
}

/**
 * Keep a screen up to date: Server-Sent Events over fetch (so the session goes in a
 * header, never in a URL), reconnecting with backoff. If streaming doesn't work through
 * the network in between (some proxies buffer it), fall back to polling every 5 s and
 * try streaming again every 2 minutes. Returns a stop function.
 */
export function connectWall(session: string, h: StreamHandlers): () => void {
    let stopped = false;
    let ctrl: AbortController | null = null;
    let failures = 0;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let pollingUntil = 0;

    const authOrGone = (e: any) => e instanceof WallApiError && (e.status === 401 || e.status === 404);

    async function poll() {
        if (stopped) return;
        try {
            h.onSnapshot(await fetchWallSnapshot(session));
            h.onStatus("polling");
        } catch (e: any) {
            if (authOrGone(e)) return h.onAuthError(e);
            h.onStatus("reconnecting");
        }
        if (Date.now() > pollingUntil) return void stream();
        pollTimer = setTimeout(poll, 5000);
    }

    function startPolling() {
        pollingUntil = Date.now() + 2 * 60 * 1000;
        void poll();
    }

    async function stream() {
        if (stopped) return;
        h.onStatus(failures ? "reconnecting" : "connecting");
        ctrl = new AbortController();
        let gotSnapshot = false;
        const watchdog = setTimeout(() => {
            if (!gotSnapshot) ctrl?.abort();
        }, 12_000);
        try {
            const res = await fetch(API_URL + "/api/public/wall/stream", {
                headers: { Authorization: `Wall ${session}`, Accept: "text/event-stream" },
                cache: "no-store",
                referrerPolicy: "no-referrer",
                signal: ctrl.signal,
            });
            if (!res.ok || !res.body) {
                let body: any = null;
                try {
                    body = await res.json();
                } catch {}
                throw new WallApiError(body?.error || "Stream failed", res.status, body?.code, body);
            }
            const reader = res.body.getReader();
            const dec = new TextDecoder();
            let buf = "";
            for (;;) {
                const { value, done } = await reader.read();
                if (done) break;
                buf += dec.decode(value, { stream: true }).replace(/\r\n/g, "\n");
                let k;
                while ((k = buf.indexOf("\n\n")) >= 0) {
                    const block = buf.slice(0, k);
                    buf = buf.slice(k + 2);
                    let ev = "message";
                    const data: string[] = [];
                    for (const line of block.split("\n")) {
                        if (line.startsWith("event:")) ev = line.slice(6).trim();
                        else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
                    }
                    if (!data.length) continue;
                    const payload = JSON.parse(data.join("\n"));
                    if (ev === "snapshot") {
                        gotSnapshot = true;
                        failures = 0;
                        h.onStatus("live");
                        h.onSnapshot(payload);
                    } else if (ev === "update") h.onUpdate(payload);
                    else if (ev === "revoked") {
                        stopped = true;
                        h.onRevoked(payload?.reason || "link");
                        return;
                    }
                }
            }
        } catch (e: any) {
            if (stopped) return;
            if (authOrGone(e)) return h.onAuthError(e);
        } finally {
            clearTimeout(watchdog);
        }
        if (stopped) return;
        failures++;
        // Streaming never got going through this network: poll instead for a while
        if (!gotSnapshot && failures >= 2) return startPolling();
        h.onStatus("reconnecting");
        retryTimer = setTimeout(stream, Math.min(30_000, 1000 * 2 ** Math.min(failures, 5)));
    }

    void stream();
    return () => {
        stopped = true;
        ctrl?.abort();
        if (pollTimer) clearTimeout(pollTimer);
        if (retryTimer) clearTimeout(retryTimer);
    };
}

/* ─────────────────────────────── Owner side ─────────────────────────────── */

/** The public address of a wall link. The token sits after #, so it never reaches the web server's logs. */
export function wallUrl(token: string): string {
    return `${window.location.origin}/w#${token}`;
}
