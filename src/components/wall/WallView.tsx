"use client";

/**
 * Wall display renderer, shared by the public screen (/w) and the editor preview (/wall).
 * Colours come from the .wall-dark / .wall-light variables (globals.css), not the app theme.
 * Text inside a tile scales with the tile (container query units), so the same wall reads
 * well on a phone, a laptop and a 65" TV.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AlertTriangle, Bell, CheckCircle2, Clock3, Power, StickyNote, Wifi, WifiOff } from "lucide-react";
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
        mq.addEventListener("change", set);
        return () => mq.removeEventListener("change", set);
    }, []);
    return theme === "auto" ? system : theme;
}

export function themeStyle(display: WallDisplay): React.CSSProperties {
    return {
        ...(display.accent ? { ["--w-accent-custom" as any]: display.accent } : {}),
        ["--wall-scale" as any]: display.textScale || 1,
        background: "var(--w-bg)",
        color: "var(--w-text)",
    };
}

/** Font size relative to the tile; small text never goes below 12px (phones). */
const fs = (n: number) => ({ fontSize: n < 12 ? `calc(max(12px, ${n}cqmin) * var(--wall-scale, 1))` : `calc(${n}cqmin * var(--wall-scale, 1))` });

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
    editor?: {
        selected?: string | null;
        onSelect: (id: string) => void;
        actions?: (t: WallTile) => React.ReactNode;
    };
}

export function WallGrid({ data, page, columns, now, flashes = {}, highlightMs = 6000, fill, rowHeight = 132, editor }: GridProps) {
    const ref = useRef<HTMLDivElement>(null);
    const [rowH, setRowH] = useState(rowHeight);
    const gap = 12;
    const cells = page.tiles.reduce((n, t) => n + Math.min(SIZE_SPAN[t.size].c, columns) * SIZE_SPAN[t.size].r, 0);
    const rows = Math.max(1, Math.ceil(cells / columns));

    useLayoutEffect(() => {
        if (!fill || !ref.current) return;
        const el = ref.current;
        const measure = () => {
            const h = el.parentElement?.clientHeight || el.clientHeight;
            setRowH(Math.max(110, Math.floor((h - gap * (rows - 1)) / rows)));
        };
        measure();
        const ro = new ResizeObserver(measure);
        if (el.parentElement) ro.observe(el.parentElement);
        return () => ro.disconnect();
    }, [fill, rows]);

    if (!page.tiles.length) {
        return (
            <div className="grid h-full min-h-40 place-items-center rounded-2xl border border-dashed text-sm" style={{ borderColor: "var(--w-border)", color: "var(--w-muted)" }}>
                Nothing on this page yet
            </div>
        );
    }

    return (
        <div
            ref={ref}
            className="grid"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gridAutoRows: `${fill ? rowH : rowHeight}px`, gridAutoFlow: "dense", gap }}
        >
            {page.tiles.map((t) => {
                const span = SIZE_SPAN[t.size] || SIZE_SPAN.s;
                const changed = flashes[t.id];
                const highlighted = changed && now - changed < highlightMs;
                return (
                    <div
                        key={t.id}
                        className={cn("relative min-w-0", editor && "cursor-pointer")}
                        style={{ gridColumn: `span ${Math.min(span.c, columns)}`, gridRow: `span ${span.r}` }}
                        onClick={editor ? () => editor.onSelect(t.id) : undefined}
                        onKeyDown={editor ? (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), editor.onSelect(t.id)) : undefined}
                        role={editor ? "button" : undefined}
                        tabIndex={editor ? 0 : undefined}
                        aria-label={editor ? `Edit tile ${tileLabel(t)}` : undefined}
                    >
                        <TileCard tile={t} data={data} now={now} changedAt={changed} highlighted={!!highlighted} selected={editor?.selected === t.id} />
                        {editor?.actions && <div className="absolute right-2 top-2 z-10">{editor.actions(t)}</div>}
                    </div>
                );
            })}
        </div>
    );
}

/* ─────────────────────────────── Tiles ─────────────────────────────── */

function TileCard({ tile, data, now, changedAt, highlighted, selected }: { tile: WallTile; data: WallData; now: number; changedAt?: number; highlighted: boolean; selected?: boolean }) {
    const v = data.values[tile.id];
    const dev = tile.dev ? data.devices[tile.dev] : undefined;
    const level = tileLevel(tile, v);
    const stale = (tile.type === "sensor" || tile.type === "actuator") && dev && !dev.online;
    const tint = level === "critical" ? "var(--w-crit)" : level === "warn" ? "var(--w-warn)" : null;

    return (
        <div
            className={cn("wall-tile relative flex h-full flex-col overflow-hidden rounded-[18px] border transition-colors duration-500", level === "critical" && "wall-alarm")}
            style={{
                background: tint ? `color-mix(in srgb, ${tint} 13%, var(--w-card))` : "var(--w-card)",
                borderColor: tint || (highlighted ? "var(--w-accent)" : "var(--w-border)"),
                boxShadow: selected ? "0 0 0 3px var(--w-accent)" : undefined,
                padding: "clamp(10px, 6cqmin, 28px)",
            }}
        >
            {tile.unavailable ? (
                <Unavailable tile={tile} />
            ) : tile.type === "sensor" ? (
                <SensorBody tile={tile} v={v} level={level} history={data.history[tile.id]} />
            ) : tile.type === "actuator" ? (
                <ActuatorBody tile={tile} v={v} />
            ) : tile.type === "status" ? (
                <StatusBody tile={tile} dev={dev} now={now} />
            ) : tile.type === "clock" ? (
                <ClockBody tile={tile} now={now} />
            ) : (
                <TextBody tile={tile} />
            )}

            {(tile.type === "sensor" || tile.type === "actuator") && !tile.unavailable && (
                <div className="mt-auto flex min-w-0 items-center gap-1.5 pt-1" style={{ ...fs(6), color: "var(--w-muted)" }}>
                    {stale ? (
                        <>
                            <WifiOff className="shrink-0" style={{ width: "1.1em", height: "1.1em", color: "var(--w-warn)" }} />
                            <span className="truncate">Offline · {ago(dev?.lastSeen, now)}</span>
                        </>
                    ) : (
                        <span className="truncate">{dev?.name}</span>
                    )}
                </div>
            )}

            {changedAt ? (
                <span
                    key={changedAt}
                    aria-hidden
                    className="wall-flash pointer-events-none absolute inset-0 rounded-[18px]"
                    style={{ background: "color-mix(in srgb, var(--w-accent) 10%, transparent)", boxShadow: "inset 0 0 0 2px var(--w-accent), 0 0 24px color-mix(in srgb, var(--w-accent) 35%, transparent)" }}
                />
            ) : null}
            {stale && <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "var(--w-bg)", opacity: 0.35 }} />}
        </div>
    );
}

function TileHead({ tile, fallback }: { tile: WallTile; fallback: any }) {
    return (
        <div className="flex min-w-0 items-center gap-[0.45em]" style={{ ...fs(7.5), color: "var(--w-muted)" }}>
            <span className="grid shrink-0 place-items-center" style={{ width: "1.35em", height: "1.35em", color: tile.color || "var(--w-muted)" }}>
                <IconRef value={tile.icon} fallback={fallback} className="h-full w-full" />
            </span>
            <span className="truncate font-medium">{tileLabel(tile)}</span>
        </div>
    );
}

function SensorBody({ tile, v, level, history }: { tile: WallTile; v: TileValue; level: string; history?: [number, number][] }) {
    const color = level === "critical" ? "var(--w-crit)" : level === "warn" ? "var(--w-warn)" : "var(--w-text)";
    const LevelIcon = level === "ok" ? null : AlertTriangle;
    const value = (
        <div className="flex min-w-0 items-baseline gap-[0.15em] font-semibold tabular-nums leading-none tracking-tight" style={{ color }}>
            <span key={String(v)} className="ts-tick truncate" style={fs(tile.style === "chart" ? 24 : 30)}>{formatValue(tile, v)}</span>
            {tile.unit && <span className="font-medium" style={{ ...fs(11), color: "var(--w-muted)" }}>{tile.unit}</span>}
            {LevelIcon && <LevelIcon className="ml-auto shrink-0 self-center" style={{ width: "9cqmin", height: "9cqmin" }} />}
        </div>
    );
    return (
        <>
            <TileHead tile={tile} fallback={Bell} />
            {tile.style === "gauge" && typeof v === "number" ? (
                <Gauge tile={tile} v={v} color={color} />
            ) : tile.style === "chart" ? (
                <div className="flex min-h-0 flex-1 flex-col pt-[3cqmin]">
                    {value}
                    <Spark points={history || []} tile={tile} />
                </div>
            ) : (
                <div className="flex min-h-0 flex-1 items-center">{value}</div>
            )}
        </>
    );
}

function Gauge({ tile, v, color }: { tile: WallTile; v: number; color: string }) {
    const min = tile.min ?? 0;
    const max = tile.max ?? 100;
    const f = Math.max(0, Math.min(1, (v - min) / (max - min || 1)));
    const r = 50;
    const arc = (to: number) => {
        const a = Math.PI * (1 - to);
        return `M 10 60 A ${r} ${r} 0 0 1 ${60 + r * Math.cos(a)} ${60 - r * Math.sin(a)}`;
    };
    return (
        <div className="relative flex min-h-0 flex-1 items-end justify-center">
            <svg viewBox="0 0 120 66" className="h-full max-h-full w-auto max-w-full" aria-hidden>
                <path d={arc(1)} fill="none" stroke="var(--w-card-2)" strokeWidth="10" strokeLinecap="round" />
                {f > 0.001 && <path d={arc(f)} fill="none" stroke={color === "var(--w-text)" ? "var(--w-accent)" : color} strokeWidth="10" strokeLinecap="round" style={{ transition: "d 600ms ease" }} />}
            </svg>
            <div className="absolute inset-x-0 bottom-0 text-center font-semibold tabular-nums leading-none" style={{ color }}>
                <span style={fs(17)}>{formatNumber(v, tile.decimals)}</span>
                {tile.unit && <span style={{ ...fs(8), color: "var(--w-muted)" }}> {tile.unit}</span>}
            </div>
        </div>
    );
}

function Spark({ points, tile }: { points: [number, number][]; tile: WallTile }) {
    if (points.length < 2) {
        return <div className="mt-auto pb-1" style={{ ...fs(5.5), color: "var(--w-faint)" }}>The last hour draws here as readings arrive</div>;
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
    const d = points.map((p, i) => `${i ? "L" : "M"} ${X(p[0]).toFixed(1)} ${Y(p[1]).toFixed(1)}`).join(" ");
    const lines = [tile.critical, tile.warn].flatMap((r, i) => [r?.below, r?.above].filter((n): n is number => n != null && n >= y0 && n <= y1).map((n) => ({ n, crit: i === 0 })));
    return (
        <svg viewBox="0 0 200 60" preserveAspectRatio="none" className="mt-auto min-h-0 w-full flex-1" style={{ color: tile.color || "var(--w-accent)" }} aria-hidden>
            {lines.map((l) => (
                <line key={`${l.n}-${l.crit}`} x1="0" x2="200" y1={Y(l.n)} y2={Y(l.n)} stroke={l.crit ? "var(--w-crit)" : "var(--w-warn)"} strokeDasharray="4 4" strokeWidth="1" vectorEffect="non-scaling-stroke" opacity="0.7" />
            ))}
            <path d={`${d} L 200 60 L 0 60 Z`} fill="currentColor" opacity="0.12" />
            <path d={d} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
    );
}

function ActuatorBody({ tile, v }: { tile: WallTile; v: TileValue }) {
    const a = isActuatorValue(v) ? v : null;
    const on = !!a?.on;
    return (
        <>
            <TileHead tile={tile} fallback={Power} />
            <div className="flex min-h-0 flex-1 items-center gap-[5cqmin]">
                <span
                    className="grid shrink-0 place-items-center rounded-full transition-all duration-500"
                    style={{
                        width: "24cqmin",
                        height: "24cqmin",
                        background: on ? "var(--w-on)" : "var(--w-card-2)",
                        color: on ? "#fff" : "var(--w-faint)",
                        boxShadow: on ? "0 0 0 5cqmin color-mix(in srgb, var(--w-on) 18%, transparent)" : undefined,
                    }}
                >
                    <Power style={{ width: "50%", height: "50%" }} />
                </span>
                <div className="min-w-0">
                    <div className="font-semibold leading-none tracking-tight" style={{ ...fs(24), color: on ? "var(--w-on)" : "var(--w-muted)" }}>
                        {a ? (on ? "ON" : "OFF") : "—"}
                    </div>
                    {a && (
                        <div className="mt-[2.5cqmin] inline-block rounded-full border px-[0.6em] py-[0.15em] font-semibold uppercase tracking-wide" style={{ ...fs(5.5), borderColor: "var(--w-border)", color: "var(--w-muted)" }}>
                            {a.auto ? "Auto" : "Manual"}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

function StatusBody({ tile, dev, now }: { tile: WallTile; dev?: { name: string; online: boolean; lastSeen: string | null }; now: number }) {
    const online = !!dev?.online;
    const Icon = online ? Wifi : WifiOff;
    return (
        <>
            <TileHead tile={{ ...tile, label: tile.label || dev?.name || "Device" }} fallback={Wifi} />
            <div className="flex min-h-0 flex-1 items-center gap-[4cqmin]">
                <Icon style={{ width: "18cqmin", height: "18cqmin", color: online ? "var(--w-on)" : "var(--w-crit)" }} />
                <div className="min-w-0">
                    <div className="font-semibold leading-none" style={{ ...fs(17), color: online ? "var(--w-on)" : "var(--w-crit)" }}>{online ? "Online" : "Offline"}</div>
                    <div className="mt-[2cqmin] truncate" style={{ ...fs(6.5), color: "var(--w-muted)" }}>Last data {ago(dev?.lastSeen, now)}</div>
                </div>
            </div>
        </>
    );
}

function ClockBody({ tile, now }: { tile: WallTile; now: number }) {
    const d = new Date(now);
    const hm = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const sec = String(d.getSeconds()).padStart(2, "0");
    return (
        <div className="flex h-full min-h-0 flex-col justify-center">
            {tile.label && <TileHead tile={tile} fallback={Clock3} />}
            <div className="flex items-baseline gap-[0.12em] font-semibold tabular-nums leading-none tracking-tight">
                <span style={fs(30)}>{hm}</span>
                <span style={{ ...fs(10), color: "var(--w-muted)" }}>{sec}</span>
            </div>
            <div className="mt-[3cqmin] truncate" style={{ ...fs(7.5), color: "var(--w-muted)" }}>
                {d.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}
            </div>
        </div>
    );
}

function TextBody({ tile }: { tile: WallTile }) {
    return (
        <>
            {tile.label && <TileHead tile={tile} fallback={StickyNote} />}
            <p className="mt-[2cqmin] min-h-0 flex-1 overflow-hidden whitespace-pre-wrap break-words font-medium leading-snug" style={fs(tile.size === "l" || tile.size === "t" ? 7 : 9)}>
                {tile.text || ""}
            </p>
        </>
    );
}

function Unavailable({ tile }: { tile: WallTile }) {
    return (
        <div className="flex h-full flex-col justify-center" style={{ color: "var(--w-faint)" }}>
            <div className="truncate font-medium" style={fs(8)}>{tile.label || "Tile"}</div>
            <div style={fs(6)}>Not available</div>
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
                const color = e.level === "critical" ? "var(--w-crit)" : e.level === "warn" ? "var(--w-warn)" : e.level === "ok" ? "var(--w-on)" : "var(--w-accent)";
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
