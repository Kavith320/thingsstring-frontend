"use client";

/**
 * Wall display renderer, shared by the public screen (/w) and the editor preview (/wall).
 * Colours come from the .wall-dark / .wall-light variables (globals.css), not the app theme.
 *
 * Sizes are worked out in JavaScript from each tile's measured width and height (not CSS
 * container units, which old TV, tablet and kiosk browsers get wrong), and big text is
 * fitted to the space it has, so nothing spills out on any screen.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AlertTriangle, Bell, CheckCircle2, Clock3, Power, StickyNote, Wifi } from "lucide-react";
import { IconRef } from "@/lib/icons";
import { cn } from "@/lib/utils";
import {
    FeedEvent,
    SIZE_SPAN,
    TileValue,
    WallData,
    WallDisplay,
    WallPage,
    WallTile,
    formatNumber,
    formatValue,
    isActuatorValue,
    tileLabel,
    tileLevel,
} from "@/lib/wall";

/* ─────────────────────────────── Helpers ─────────────────────────────── */

export function ago(iso: string | number | null | undefined, now: number): string {
    if (!iso) return "never";
    const ms = typeof iso === "number" ? iso : Date.parse(iso);
    if (!Number.isFinite(ms)) return "never";
    const s = Math.max(0, Math.round((now - ms) / 1000));
    if (s < 10) return "just now";
    if (s < 60) return `${s}s ago`;
    const m = Math.round(s / 60);
    if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60);
    if (h < 48) return `${h} h ago`;
    return `${Math.round(h / 24)} days ago`;
}

/** "auto" follows the screen's light/dark setting. */
export function useWallTheme(theme: WallDisplay["theme"]): "light" | "dark" {
    const [system, setSystem] = useState<"light" | "dark">("dark");
    useEffect(() => {
        const mq = window.matchMedia("(prefers-color-scheme: dark)");
        const set = () => setSystem(mq.matches ? "dark" : "light");
        set();
        // Safari < 14 only has addListener
        if (mq.addEventListener) mq.addEventListener("change", set);
        else mq.addListener(set);
        return () => (mq.removeEventListener ? mq.removeEventListener("change", set) : mq.removeListener(set));
    }, []);
    return theme === "auto" ? system : theme;
}

export function themeStyle(display: WallDisplay): React.CSSProperties {
    return {
        ...(display.accent ? { ["--w-accent-custom" as any]: display.accent } : {}),
        background: "var(--w-bg)",
        color: "var(--w-text)",
    };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Largest font size (px) at which `text` fits in width × height on one line. */
function fit(text: string, width: number, height: number, max: number, glyph = 0.6) {
    const n = Math.max(1, text.length);
    return Math.max(10, Math.floor(Math.min(max, height, width / (n * glyph))));
}

/** "#22c55e" + alpha → "#22c55e26"; other colour formats fall back. */
function alpha(color: string | null | undefined, a: string, fallback: string) {
    return color && /^#[0-9a-f]{6}$/i.test(color) ? color + a : fallback;
}

/* ─────────────────────────────── Grid ─────────────────────────────── */

interface GridProps {
    data: WallData;
    page: WallPage;
    columns: number;
    now: number;
    /** tileId -> time of its last change (restarts the highlight) */
    flashes?: Record<string, number>;
    highlightMs?: number;
    /** fill the available height (the screen); otherwise fixed rows (editor) */
    fill?: boolean;
    rowHeight?: number;
    textScale?: number;
    editor?: {
        selected?: string | null;
        onSelect: (id: string) => void;
        actions?: (t: WallTile) => React.ReactNode;
    };
}

const GAP = 12;

export function WallGrid({ data, page, columns, now, flashes = {}, highlightMs = 6000, fill, rowHeight = 150, textScale = 1, editor }: GridProps) {
    const ref = useRef<HTMLDivElement>(null);
    const [box, setBox] = useState({ w: 0, h: 0 });
    const cells = page.tiles.reduce((n, t) => n + Math.min(SIZE_SPAN[t.size].c, columns) * SIZE_SPAN[t.size].r, 0);
    const rows = Math.max(1, Math.ceil(cells / columns));

    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        const measure = () => setBox({ w: el.clientWidth, h: el.parentElement?.clientHeight || 0 });
        measure();
        if (typeof ResizeObserver === "undefined") {
            window.addEventListener("resize", measure);
            return () => window.removeEventListener("resize", measure);
        }
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        if (el.parentElement) ro.observe(el.parentElement);
        return () => ro.disconnect();
    }, []);

    const colW = box.w ? (box.w - GAP * (columns - 1)) / columns : 0;
    // Fill the screen, but never taller than a little more than wide (no tall towers)
    const rowH = fill && box.h && colW ? Math.floor(clamp((box.h - GAP * (rows - 1)) / rows, 110, Math.max(130, colW * 0.85))) : rowHeight;

    if (!page.tiles.length) {
        return (
            <div ref={ref} className="grid h-full min-h-40 place-items-center rounded-2xl border border-dashed text-sm" style={{ borderColor: "var(--w-border)", color: "var(--w-muted)" }}>
                Nothing on this page yet
            </div>
        );
    }

    return (
        <div ref={ref} className="grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gridAutoRows: `${rowH}px`, gridAutoFlow: "dense", gap: GAP }}>
            {page.tiles.map((t) => {
                const span = SIZE_SPAN[t.size] || SIZE_SPAN.s;
                const c = Math.min(span.c, columns);
                const w = colW ? colW * c + GAP * (c - 1) : 0;
                const h = rowH * span.r + GAP * (span.r - 1);
                const changed = flashes[t.id];
                const highlighted = !!changed && now - changed < highlightMs;
                return (
                    <div
                        key={t.id}
                        className={cn("relative min-w-0", editor && "cursor-pointer")}
                        style={{ gridColumn: `span ${c}`, gridRow: `span ${span.r}` }}
                        onClick={editor ? () => editor.onSelect(t.id) : undefined}
                        onKeyDown={editor ? (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), editor.onSelect(t.id)) : undefined}
                        role={editor ? "button" : undefined}
                        tabIndex={editor ? 0 : undefined}
                        aria-label={editor ? `Edit tile ${tileLabel(t)}` : undefined}
                    >
                        {w > 0 && <TileCard tile={t} data={data} now={now} w={w} h={h} scale={textScale} changedAt={changed} highlighted={highlighted} selected={editor?.selected === t.id} />}
                        {editor?.actions && <div className="absolute right-2 top-2 z-10">{editor.actions(t)}</div>}
                    </div>
                );
            })}
        </div>
    );
}

/* ─────────────────────────────── Tile frame ─────────────────────────────── */

/** Sizes for one tile, from its measured box. */
interface Dims {
    w: number;
    h: number;
    pad: number;
    /** inner width / height */
    iw: number;
    ih: number;
    label: number;
    small: number;
    /** height left for the main value */
    body: number;
    scale: number;
}

function dims(w: number, h: number, scale: number): Dims {
    const m = Math.min(w, h);
    const pad = clamp(m * 0.09, 12, 28);
    const iw = w - pad * 2;
    const ih = h - pad * 2;
    const label = clamp(m * 0.085 * scale, 12, 26);
    const small = clamp(m * 0.062 * scale, 11, 18);
    const body = Math.max(20, ih - label * 1.9 - small * 1.8);
    return { w, h, pad, iw, ih, label, small, body, scale };
}

interface CardProps {
    tile: WallTile;
    data: WallData;
    now: number;
    w: number;
    h: number;
    scale: number;
    changedAt?: number;
    highlighted: boolean;
    selected?: boolean;
}

function TileCard({ tile, data, now, w, h, scale, changedAt, highlighted, selected }: CardProps) {
    const d = dims(w, h, scale);
    const v = data.values[tile.id];
    const dev = tile.dev ? data.devices[tile.dev] : undefined;
    const level = tileLevel(tile, v);
    const stale = (tile.type === "sensor" || tile.type === "actuator") && !!dev && !dev.online;
    const on = tile.type === "actuator" && isActuatorValue(v) && v.on;

    const bg = level === "critical" ? "var(--w-crit-bg)" : level === "warn" ? "var(--w-warn-bg)" : on ? "var(--w-on-bg)" : "var(--w-card)";
    const border = level === "critical" ? "var(--w-crit)" : level === "warn" ? "var(--w-warn)" : highlighted ? "var(--w-hl)" : "var(--w-border)";

    return (
        <div
            className={cn("relative flex h-full flex-col overflow-hidden rounded-[18px] border transition-colors duration-500", level === "critical" && "wall-alarm")}
            style={{ background: bg, borderColor: border, padding: d.pad, boxShadow: selected ? "0 0 0 3px var(--w-accent)" : undefined }}
        >
            {tile.unavailable ? (
                <Unavailable tile={tile} d={d} />
            ) : tile.type === "sensor" ? (
                <SensorBody tile={tile} v={v} level={level} history={data.history[tile.id]} d={d} />
            ) : tile.type === "actuator" ? (
                <ActuatorBody tile={tile} v={v} d={d} />
            ) : tile.type === "status" ? (
                <StatusBody tile={tile} dev={dev} now={now} d={d} />
            ) : tile.type === "clock" ? (
                <ClockBody tile={tile} now={now} d={d} />
            ) : (
                <TextBody tile={tile} d={d} />
            )}

            {(tile.type === "sensor" || tile.type === "actuator") && !tile.unavailable && (
                <Footer d={d} warn={stale}>{stale ? `Offline · ${ago(dev?.lastSeen, now)}` : dev?.name || ""}</Footer>
            )}

            {changedAt ? <span key={changedAt} aria-hidden className="wall-flash pointer-events-none absolute inset-0 rounded-[18px]" style={{ background: "var(--w-flash)" }} /> : null}
            {stale && <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "var(--w-bg)", opacity: 0.35 }} />}
        </div>
    );
}

/** Icon chip + label, with an optional badge on the right. */
function Head({ tile, d, fallback, badge, label }: { tile: WallTile; d: Dims; fallback: any; badge?: React.ReactNode; label?: string }) {
    const chip = Math.round(d.label * 1.65);
    return (
        <div className="flex min-w-0 shrink-0 items-center" style={{ gap: d.label * 0.55, height: chip }}>
            <span
                className="grid shrink-0 place-items-center overflow-hidden"
                style={{ width: chip, height: chip, borderRadius: chip * 0.3, background: alpha(tile.color, "26", "var(--w-card-2)"), color: tile.color || "var(--w-muted)" }}
            >
                {tile.icon?.startsWith("file:") ? (
                    <IconRef value={tile.icon} fallback={fallback} className="h-full w-full" />
                ) : (
                    <span className="grid place-items-center" style={{ width: chip * 0.55, height: chip * 0.55, fontSize: chip * 0.5 }}>
                        <IconRef value={tile.icon} fallback={fallback} className="h-full w-full" />
                    </span>
                )}
            </span>
            <span className="min-w-0 flex-1 truncate font-medium" style={{ fontSize: d.label, color: "var(--w-muted)", lineHeight: 1.2 }}>
                {label ?? tileLabel(tile)}
            </span>
            {badge}
        </div>
    );
}

function Badge({ d, color, children }: { d: Dims; color: string; children: React.ReactNode }) {
    return (
        <span className="shrink-0 rounded-full font-semibold uppercase" style={{ fontSize: Math.max(10, d.small * 0.85), padding: `${d.small * 0.15}px ${d.small * 0.6}px`, letterSpacing: "0.04em", color, border: `1px solid ${color}` }}>
            {children}
        </span>
    );
}

function Footer({ d, warn, children }: { d: Dims; warn?: boolean; children: React.ReactNode }) {
    return (
        <div className="mt-auto shrink-0 truncate" style={{ fontSize: d.small, lineHeight: 1.3, paddingTop: d.small * 0.4, color: warn ? "var(--w-warn)" : "var(--w-faint)" }}>
            {children}
        </div>
    );
}

/* ─────────────────────────────── Tile bodies ─────────────────────────────── */

function BigValue({ text, unit, d, height, color }: { text: string; unit?: string | null; d: Dims; height: number; color: string }) {
    const unitText = unit ? ` ${unit}` : "";
    // Unit is drawn at ~40% size, so it counts as fewer characters
    const size = fit(text + "x".repeat(Math.ceil(unitText.length * 0.45)), d.iw, height * 0.8, 128 * d.scale, 0.58);
    return (
        <div className="flex min-w-0 items-baseline font-semibold tabular-nums" style={{ color, lineHeight: 1, letterSpacing: "-0.02em" }}>
            <span key={text} className="ts-tick whitespace-nowrap" style={{ fontSize: size }}>{text}</span>
            {unit && <span className="ml-1 whitespace-nowrap font-medium" style={{ fontSize: Math.max(11, size * 0.4), color: "var(--w-muted)" }}>{unit}</span>}
        </div>
    );
}

function SensorBody({ tile, v, level, history, d }: { tile: WallTile; v: TileValue; level: string; history?: [number, number][]; d: Dims }) {
    const color = level === "critical" ? "var(--w-crit)" : level === "warn" ? "var(--w-warn)" : "var(--w-text)";
    const range = level === "critical" ? tile.critical : tile.warn;
    const low = typeof v === "number" && range?.below != null && v < range.below;
    const badge = level !== "ok" ? <Badge d={d} color={color}>{low ? "Low" : "High"}</Badge> : null;
    const text = formatValue(tile, v);

    if (tile.style === "gauge" && typeof v === "number") {
        return (
            <>
                <Head tile={tile} d={d} fallback={Bell} badge={badge} />
                <Gauge tile={tile} v={v} color={color} d={d} />
            </>
        );
    }
    if (tile.style === "chart") {
        const valueH = Math.min(d.body * 0.42, d.label * 3);
        return (
            <>
                <Head tile={tile} d={d} fallback={Bell} badge={badge} />
                <div className="flex min-h-0 flex-1 flex-col" style={{ paddingTop: d.label * 0.5 }}>
                    <BigValue text={text} unit={tile.unit} d={d} height={valueH} color={color} />
                    <Spark points={history || []} tile={tile} d={d} />
                </div>
            </>
        );
    }
    return (
        <>
            <Head tile={tile} d={d} fallback={Bell} badge={badge} />
            <div className="flex min-h-0 flex-1 items-center">
                <BigValue text={text} unit={tile.unit} d={d} height={Math.min(d.body, d.iw * 0.38)} color={color} />
            </div>
        </>
    );
}

function Gauge({ tile, v, color, d }: { tile: WallTile; v: number; color: string; d: Dims }) {
    const min = tile.min ?? 0;
    const max = tile.max ?? 100;
    const f = clamp((v - min) / (max - min || 1), 0, 1);
    const r = 50;
    const arc = (to: number) => {
        const a = Math.PI * (1 - to);
        return `M 10 60 A ${r} ${r} 0 0 1 ${(60 + r * Math.cos(a)).toFixed(2)} ${(60 - r * Math.sin(a)).toFixed(2)}`;
    };
    // The arc is 120 × 66; size it to the space, keep room for the number under it
    const gw = Math.min(d.iw, (d.body - 4) * 1.8);
    const num = formatNumber(v, tile.decimals);
    const size = fit(num + (tile.unit ? "xx" : ""), gw * 0.55, gw * 0.2, 80 * d.scale, 0.58);
    return (
        <div className="relative flex min-h-0 flex-1 items-end justify-center">
            <svg viewBox="0 0 120 66" width={gw} height={gw * 0.55} aria-hidden>
                <path d={arc(1)} fill="none" stroke="var(--w-border)" strokeWidth="10" strokeLinecap="round" />
                {f > 0.001 && <path d={arc(f)} fill="none" stroke={color === "var(--w-text)" ? tile.color || "var(--w-accent)" : color} strokeWidth="10" strokeLinecap="round" />}
            </svg>
            <div className="absolute inset-x-0 bottom-0 text-center font-semibold tabular-nums" style={{ color, lineHeight: 1 }}>
                <span style={{ fontSize: size }}>{num}</span>
                {tile.unit && <span style={{ fontSize: Math.max(11, size * 0.45), color: "var(--w-muted)" }}> {tile.unit}</span>}
            </div>
        </div>
    );
}

function Spark({ points, tile, d }: { points: [number, number][]; tile: WallTile; d: Dims }) {
    if (points.length < 2) {
        return <div className="mt-auto" style={{ fontSize: d.small, color: "var(--w-faint)" }}>The last hour draws here as readings arrive</div>;
    }
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    const x0 = Math.min(...xs);
    const x1 = Math.max(...xs);
    let y0 = Math.min(...ys);
    let y1 = Math.max(...ys);
    if (y1 - y0 < 1e-9) {
        y0 -= 1;
        y1 += 1;
    }
    const X = (t: number) => ((t - x0) / (x1 - x0 || 1)) * 200;
    const Y = (v: number) => 56 - ((v - y0) / (y1 - y0)) * 52;
    const line = points.map((p, i) => `${i ? "L" : "M"} ${X(p[0]).toFixed(1)} ${Y(p[1]).toFixed(1)}`).join(" ");
    const limits = [tile.critical, tile.warn].flatMap((r, i) => [r?.below, r?.above].filter((n): n is number => n != null && n >= y0 && n <= y1).map((n) => ({ n, crit: i === 0 })));
    return (
        <svg viewBox="0 0 200 60" preserveAspectRatio="none" className="mt-auto min-h-0 w-full flex-1" style={{ color: tile.color || "var(--w-accent)", marginTop: d.small * 0.5 }} aria-hidden>
            {limits.map((l) => (
                <line key={`${l.n}-${l.crit}`} x1="0" x2="200" y1={Y(l.n)} y2={Y(l.n)} stroke={l.crit ? "var(--w-crit)" : "var(--w-warn)"} strokeDasharray="4 4" strokeWidth="1" vectorEffect="non-scaling-stroke" opacity="0.7" />
            ))}
            <path d={`${line} L 200 60 L 0 60 Z`} fill="currentColor" opacity="0.12" />
            <path d={line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
    );
}

function ActuatorBody({ tile, v, d }: { tile: WallTile; v: TileValue; d: Dims }) {
    const a = isActuatorValue(v) ? v : null;
    const on = !!a?.on;
    const state = a ? (on ? "ON" : "OFF") : "—";
    // A switch drawn next to the state, both sized to the space
    const size = fit(state + "xxxx", d.iw, Math.min(d.body, d.iw * 0.4) * 0.6, 96 * d.scale, 0.62);
    const trackW = size * 1.7;
    const trackH = size * 0.95;
    const knob = trackH - 6;
    return (
        <>
            <Head tile={tile} d={d} fallback={Power} badge={a ? <Badge d={d} color="var(--w-muted)">{a.auto ? "Auto" : "Manual"}</Badge> : null} />
            <div className="flex min-h-0 flex-1 items-center" style={{ gap: size * 0.45 }}>
                <span
                    aria-hidden
                    className="relative shrink-0 rounded-full transition-colors duration-500"
                    style={{ width: trackW, height: trackH, background: on ? "var(--w-on)" : "var(--w-card-2)", border: on ? "none" : "1px solid var(--w-border)" }}
                >
                    <span
                        className="absolute top-1/2 rounded-full shadow transition-all duration-500"
                        style={{ width: knob, height: knob, marginTop: -knob / 2, left: on ? trackW - knob - 3 : 3, background: on ? "#fff" : "var(--w-faint)" }}
                    />
                </span>
                <span className="font-semibold tracking-tight" style={{ fontSize: size, lineHeight: 1, color: on ? "var(--w-on)" : "var(--w-muted)" }}>{state}</span>
            </div>
        </>
    );
}

function StatusBody({ tile, dev, now, d }: { tile: WallTile; dev?: { name: string; online: boolean; lastSeen: string | null }; now: number; d: Dims }) {
    const online = !!dev?.online;
    const word = online ? "Online" : "Offline";
    const color = online ? "var(--w-on)" : "var(--w-crit)";
    const size = fit(word + "xx", d.iw, Math.min(d.body, d.iw * 0.3) * 0.6, 60 * d.scale, 0.6);
    const dot = Math.max(10, size * 0.42);
    return (
        <>
            <Head tile={tile} d={d} fallback={Wifi} label={tile.label || dev?.name || "Device"} />
            <div className="flex min-h-0 flex-1 items-center" style={{ gap: size * 0.4 }}>
                <span className="relative flex shrink-0" style={{ width: dot, height: dot }} aria-hidden>
                    {online && <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-40 motion-reduce:hidden" style={{ background: color }} />}
                    <span className="relative inline-flex rounded-full" style={{ width: dot, height: dot, background: color }} />
                </span>
                <span className="font-semibold tracking-tight" style={{ fontSize: size, lineHeight: 1, color }}>{word}</span>
            </div>
            <Footer d={d}>Last data {ago(dev?.lastSeen, now)}</Footer>
        </>
    );
}

function ClockBody({ tile, now, d }: { tile: WallTile; now: number; d: Dims }) {
    const t = new Date(now);
    const hm = t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const date = t.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });
    const avail = tile.label ? d.body : d.ih - d.small * 2;
    const size = fit(hm + "x", d.iw * 0.9, avail * 0.62, 150 * d.scale, 0.56);
    return (
        <div className="flex h-full min-h-0 flex-col">
            {tile.label && <Head tile={tile} d={d} fallback={Clock3} />}
            <div className="flex min-h-0 flex-1 flex-col justify-center">
                <div className="flex items-baseline font-semibold tabular-nums" style={{ lineHeight: 1, letterSpacing: "-0.02em" }}>
                    <span style={{ fontSize: size }}>{hm}</span>
                    <span className="ml-1" style={{ fontSize: Math.max(11, size * 0.3), color: "var(--w-muted)" }}>{String(t.getSeconds()).padStart(2, "0")}</span>
                </div>
                <div className="truncate" style={{ fontSize: clamp(size * 0.22, 12, 28), color: "var(--w-muted)", marginTop: size * 0.12 }}>{date}</div>
            </div>
        </div>
    );
}

function TextBody({ tile, d }: { tile: WallTile; d: Dims }) {
    const text = tile.text || "";
    const avail = tile.label ? d.body + d.small * 1.8 : d.ih;
    // Font size at which the text fills the box: lines × lineHeight ≤ height
    // (0.8: words wrap early, so lines are shorter than the full width)
    const size = clamp(0.8 * Math.sqrt((d.iw * avail) / (Math.max(text.length, 8) * 0.56 * 1.35)), 12, 36 * d.scale);
    return (
        <>
            {tile.label && <Head tile={tile} d={d} fallback={StickyNote} />}
            <p className="min-h-0 flex-1 overflow-hidden whitespace-pre-wrap break-words font-medium" style={{ fontSize: size, lineHeight: 1.35, marginTop: tile.label ? d.label * 0.5 : 0 }}>
                {text}
            </p>
        </>
    );
}

function Unavailable({ tile, d }: { tile: WallTile; d: Dims }) {
    return (
        <div className="flex h-full flex-col justify-center" style={{ color: "var(--w-faint)" }}>
            <div className="truncate font-medium" style={{ fontSize: d.label }}>{tile.label || "Tile"}</div>
            <div style={{ fontSize: d.small }}>Not available</div>
        </div>
    );
}

/* ─────────────────────────────── Event feed ─────────────────────────────── */

export function FeedList({ events, now, compact }: { events: FeedEvent[]; now: number; compact?: boolean }) {
    if (!events.length) {
        return <p className="px-1 text-sm" style={{ color: "var(--w-faint)" }}>Switches turning on or off, readings crossing a limit and devices going offline show up here.</p>;
    }
    return (
        <ol className={cn("space-y-2", compact && "flex gap-2 space-y-0")}>
            {events.map((e) => {
                const color = e.level === "critical" ? "var(--w-crit)" : e.level === "warn" ? "var(--w-warn)" : e.level === "ok" ? "var(--w-on)" : "var(--w-muted)";
                const Icon = e.level === "critical" || e.level === "warn" ? AlertTriangle : e.level === "ok" ? CheckCircle2 : e.kind === "actuator" ? Power : Bell;
                return (
                    <li key={e.id} className={cn("wall-feed-in flex items-start gap-2.5 rounded-xl border px-3 py-2.5", compact && "shrink-0")} style={{ borderColor: "var(--w-border)", background: "var(--w-card)" }}>
                        <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color }} />
                        <div className="min-w-0">
                            <div className="text-sm font-medium leading-snug" style={{ color: "var(--w-text)" }}>{e.text}</div>
                            <div className="text-xs tabular-nums" style={{ color: "var(--w-muted)" }}>
                                {new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {ago(e.at, now)}
                            </div>
                        </div>
                    </li>
                );
            })}
        </ol>
    );
}
