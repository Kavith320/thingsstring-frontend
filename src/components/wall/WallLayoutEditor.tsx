"use client";

/**
 * Drag-and-drop layout for one wall page, drawn exactly as the screen will show it.
 * Drag a tile to move it (dropping it on a tile of a size that fits swaps the two), drag a
 * corner to resize it. Groups move with their tiles; drag a group by its frame. Tiles snap
 * to the canvas grid, never overlap, and sit fully inside a group or fully outside it.
 * Keyboard: arrows move the selected tile or group, Shift + arrows resize, Enter edits.
 */
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Cell, Placed, Rect, WallData, WallDisplay, WallGroup, WallPage, canvasRects, cellRect, contains, crossesGroup, geometry, layoutTiles, overlaps, stageSize, tileLabel } from "@/lib/wall";
import { ScaledStage, StageHeader, StageTiles } from "@/components/wall/WallView";

type Corner = "nw" | "ne" | "sw" | "se";
type Mode = "move" | Corner;

interface Drag {
    kind: "tile" | "group";
    id: string;
    mode: Mode;
    pointer: number;
    /** screen pixels per stage unit */
    scale: number;
    x0: number;
    y0: number;
    /** pointer movement in stage units */
    dx: number;
    dy: number;
    orig: Cell;
    target: Cell;
    /** every cell that changes if dropped here (the item, a swapped tile, a group's tiles) */
    moves: Record<string, Cell>;
    valid: boolean;
    moved: boolean;
}

export interface LayoutEditorProps {
    data: WallData;
    page: WallPage;
    display: WallDisplay;
    title: string;
    now: number;
    selected: string | null;
    onSelect: (id: string | null) => void;
    /** new cells for the tiles and groups that moved */
    onMove: (cells: Record<string, Cell>) => void;
    onEdit: (id: string) => void;
    onEditGroup: (id: string) => void;
    /** buttons shown on the selected tile / group */
    toolbar: (id: string) => React.ReactNode;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const cellOf = (c: Cell): Cell => ({ x: c.x, y: c.y, w: c.w, h: c.h });

export default function WallLayoutEditor({ data, page, display, title, now, selected, onSelect, onMove, onEdit, onEditGroup, toolbar }: LayoutEditorProps) {
    const { cols, rows } = display.canvas;
    const stage = stageSize(display.canvas);
    const geom = geometry(stage, cols, rows);
    const groups = page.groups || [];
    const { placed } = layoutTiles(page.tiles, cols, rows, groups);
    const [drag, setDrag] = useState<Drag | null>(null);
    const stepX = geom.cw + geom.gap;
    const stepY = geom.ch + geom.gap;

    function moved(mode: Mode, orig: Cell, mx: number, my: number): Cell {
        if (mode === "move") return { ...orig, x: clamp(orig.x + mx, 0, cols - orig.w), y: clamp(orig.y + my, 0, rows - orig.h) };
        let { x, y, w, h } = orig;
        if (mode === "ne" || mode === "se") w = clamp(orig.w + mx, 1, cols - orig.x);
        else {
            x = clamp(orig.x + mx, 0, orig.x + orig.w - 1);
            w = orig.x + orig.w - x;
        }
        if (mode === "sw" || mode === "se") h = clamp(orig.h + my, 1, rows - orig.y);
        else {
            y = clamp(orig.y + my, 0, orig.y + orig.h - 1);
            h = orig.y + orig.h - y;
        }
        return { x, y, w, h };
    }

    /** Where a tile would land, and whether that's allowed. */
    function resolveTile(id: string, mode: Mode, orig: Cell, mx: number, my: number): Pick<Drag, "target" | "moves" | "valid"> {
        const target = moved(mode, orig, mx, my);
        const bad = { target, moves: {}, valid: false };
        if (crossesGroup(target, groups)) return bad;
        const others = placed.filter((p) => p.id !== id);
        const hits = others.filter((p) => overlaps(p, target));
        if (!hits.length) return { target, moves: { [id]: target }, valid: true };
        // Dropped onto one tile: swap them if it fits where this one was
        if (mode === "move" && hits.length === 1) {
            const b = hits[0];
            const cell = { x: clamp(orig.x, 0, cols - b.w), y: clamp(orig.y, 0, rows - b.h), w: b.w, h: b.h };
            const clear = !overlaps(cell, target) && !others.some((p) => p.id !== b.id && overlaps(p, cell)) && !crossesGroup(cell, groups);
            if (clear) return { target, moves: { [id]: target, [b.id]: cell }, valid: true };
        }
        return bad;
    }

    /** Where a group would land: its tiles move with it; nothing may end up across its edge. */
    function resolveGroup(id: string, mode: Mode, orig: Cell, mx: number, my: number): Pick<Drag, "target" | "moves" | "valid"> {
        const target = moved(mode, orig, mx, my);
        const bad = { target, moves: {}, valid: false };
        if (groups.some((g) => g.id !== id && overlaps(g, target))) return bad;
        const moves: Record<string, Cell> = { [id]: target };
        if (mode === "move") {
            const ddx = target.x - orig.x;
            const ddy = target.y - orig.y;
            const members = placed.filter((t) => contains(orig, t));
            const after = members.map((t) => ({ id: t.id, c: { ...cellOf(t), x: t.x + ddx, y: t.y + ddy } }));
            for (const m of after) moves[m.id] = m.c;
            for (const t of placed) {
                if (moves[t.id]) continue;
                if (after.some((m) => overlaps(m.c, t)) || crossesGroup(t, [target])) return bad;
            }
        } else if (placed.some((t) => crossesGroup(t, [target]))) return bad;
        return { target, moves, valid: true };
    }

    const resolve = (kind: Drag["kind"], id: string, mode: Mode, orig: Cell, dx: number, dy: number) =>
        (kind === "tile" ? resolveTile : resolveGroup)(id, mode, orig, Math.round(dx / stepX), Math.round(dy / stepY));

    function begin(e: React.PointerEvent, kind: Drag["kind"], item: Cell & { id: string }, mode: Mode) {
        if (e.button !== 0) return;
        e.stopPropagation();
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        const orig = cellOf(item);
        const el = (e.currentTarget as HTMLElement).closest("[data-stage]") as HTMLElement | null;
        const scale = el ? el.getBoundingClientRect().width / stage.w : 1;
        setDrag({ kind, id: item.id, mode, pointer: e.pointerId, scale: scale || 1, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, orig, target: orig, moves: {}, valid: true, moved: false });
        if (mode !== "move") onSelect(item.id);
    }

    function moveTo(e: React.PointerEvent) {
        if (!drag || e.pointerId !== drag.pointer) return;
        const dx = (e.clientX - drag.x0) / drag.scale;
        const dy = (e.clientY - drag.y0) / drag.scale;
        const isMoved = drag.moved || Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 5;
        setDrag({ ...drag, dx, dy, moved: isMoved, ...resolve(drag.kind, drag.id, drag.mode, drag.orig, dx, dy) });
    }

    function end(e: React.PointerEvent) {
        if (!drag || e.pointerId !== drag.pointer) return;
        const d = drag;
        setDrag(null);
        if (!d.moved) return onSelect(d.id);
        const same = d.target.x === d.orig.x && d.target.y === d.orig.y && d.target.w === d.orig.w && d.target.h === d.orig.h;
        if (!d.valid || same) return;
        onMove(d.moves);
        onSelect(d.id);
    }

    function onKey(e: React.KeyboardEvent, kind: Drag["kind"], item: Cell & { id: string }) {
        if (e.key === "Enter") {
            e.preventDefault();
            return kind === "tile" ? onEdit(item.id) : onEditGroup(item.id);
        }
        if (e.key === "Escape") return onSelect(null);
        const dir = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<string, number[]>)[e.key];
        if (!dir) return;
        e.preventDefault();
        e.stopPropagation();
        // Shift + arrows: right/down grow, left/up shrink (from the bottom-right corner)
        const r = resolve(kind, item.id, e.shiftKey ? "se" : "move", cellOf(item), dir[0] * stepX, dir[1] * stepY);
        if (r.valid) onMove(r.moves);
    }

    // While dragging, show where things will land (a dragged tile follows the pointer)
    const live = drag?.moved && drag.valid ? drag.moves : {};
    const followId = drag?.moved && drag.kind === "tile" && drag.mode === "move" ? drag.id : null;
    const shownGroups: WallGroup[] = groups.map((g) => (live[g.id] ? { ...g, ...live[g.id] } : g));
    const shownTiles: Placed[] = placed.map((t) => (live[t.id] && t.id !== followId ? { ...t, ...live[t.id] } : t));
    const laid = canvasRects(shownTiles, shownGroups, geom);

    const handles = (kind: Drag["kind"], item: Cell & { id: string }, visible: boolean, ui: number) =>
        (["nw", "ne", "sw", "se"] as Corner[]).map((c) => {
            const size = 18 * ui;
            return (
                <span
                    key={c}
                    aria-hidden
                    className={cn("absolute z-10 rounded-full bg-white transition-opacity", visible ? "opacity-100" : "opacity-0 group-hover:opacity-100")}
                    style={{
                        width: size,
                        height: size,
                        border: `${2 * ui}px solid var(--w-accent)`,
                        left: c.endsWith("w") ? -size / 2 : undefined,
                        right: c.endsWith("e") ? -size / 2 : undefined,
                        top: c.startsWith("n") ? -size / 2 : undefined,
                        bottom: c.startsWith("s") ? -size / 2 : undefined,
                        cursor: c === "nw" || c === "se" ? "nwse-resize" : "nesw-resize",
                        touchAction: "none",
                    }}
                    onPointerDown={(e) => begin(e, kind, item, c)}
                    onPointerMove={moveTo}
                    onPointerUp={end}
                    onPointerCancel={() => setDrag(null)}
                />
            );
        });

    const sizeBadge = (id: string, ui: number) =>
        drag?.id === id && drag.mode !== "move" && drag.moved ? (
            <span className="pointer-events-none absolute left-1/2 top-1/2 z-10 rounded-lg font-semibold" style={{ transform: `translate(-50%, -50%) scale(${ui})`, background: "var(--w-text)", color: "var(--w-bg)", padding: "4px 10px", fontSize: 13 }}>
                {drag.target.w} × {drag.target.h}
            </span>
        ) : null;

    const toolbarAt = (id: string, ui: number) =>
        selected === id && !drag?.moved ? (
            <div className="absolute right-0 z-20" style={{ top: 0, transform: `scale(${ui})`, transformOrigin: "top right", padding: 8 }} onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
                {toolbar(id)}
            </div>
        ) : null;

    return (
        <ScaledStage w={stage.w} h={stage.h} fit="width" maxVh={0.8} className="w-full select-none rounded-xl" style={{ background: "var(--w-bg)" }}>
            {(s) => {
                const ui = 1 / s; // one screen pixel in stage units
                return (
                    <div data-stage className="absolute inset-0" onPointerDown={() => onSelect(null)}>
                        <StageHeader title={title || "Wall display"} sub={null} now={now} showClock={display.showClock} />

                        {/* The grid */}
                        <div aria-hidden className="pointer-events-none absolute inset-0">
                            {Array.from({ length: cols * rows }, (_, i) => {
                                const r = cellRect(geom, { x: i % cols, y: Math.floor(i / cols), w: 1, h: 1 });
                                return <div key={i} className="absolute transition-opacity" style={{ ...r, borderRadius: 14, border: `${1.5 * ui}px dashed var(--w-border)`, opacity: drag?.moved ? 0.9 : 0.45 }} />;
                            })}
                        </div>

                        {/* Where a dragged tile or group will land */}
                        {drag?.moved && (
                            <div
                                aria-hidden
                                className="pointer-events-none absolute z-[5]"
                                style={{ ...cellRect(geom, drag.target), borderRadius: 18, border: `${3 * ui}px dashed ${drag.valid ? "var(--w-accent)" : "var(--w-crit)"}`, background: drag.valid ? "rgba(59,130,246,.10)" : "rgba(239,68,68,.12)" }}
                            />
                        )}

                        <StageTiles
                            data={data}
                            items={laid.items}
                            frames={laid.frames}
                            now={now}
                            textScale={display.textScale}
                            selected={selected}
                            renderGroup={(g, r: Rect, frame) => {
                                const isSel = selected === g.id;
                                return (
                                    <div
                                        role="button"
                                        tabIndex={0}
                                        aria-label={`Group ${g.label || ""}: ${g.w} by ${g.h} cells at column ${g.x + 1}, row ${g.y + 1}. Arrows move it with its tiles, Shift and arrows resize, Enter edits.`}
                                        aria-pressed={isSel}
                                        className={cn("group absolute outline-none", drag?.id === g.id ? "cursor-grabbing" : "cursor-grab", !drag && "transition-[left,top,width,height] duration-200")}
                                        style={{ ...r, touchAction: "none", zIndex: isSel ? 1 : 0 }}
                                        onPointerDown={(e) => begin(e, "group", g, "move")}
                                        onPointerMove={moveTo}
                                        onPointerUp={end}
                                        onPointerCancel={() => setDrag(null)}
                                        onDoubleClick={() => onEditGroup(g.id)}
                                        onKeyDown={(e) => onKey(e, "group", g)}
                                        onFocus={() => !isSel && onSelect(g.id)}
                                    >
                                        <div className="pointer-events-none h-full">{frame}</div>
                                        {handles("group", g, isSel, ui)}
                                        {sizeBadge(g.id, ui)}
                                        {toolbarAt(g.id, ui)}
                                    </div>
                                );
                            }}
                            renderTile={(t, r, card) => {
                                const following = followId === t.id;
                                const isSel = selected === t.id;
                                return (
                                    <div
                                        role="button"
                                        tabIndex={0}
                                        aria-label={`${tileLabel(t)}: ${t.w} by ${t.h} cells at column ${t.x + 1}, row ${t.y + 1}. Arrows move, Shift and arrows resize, Enter edits.`}
                                        aria-pressed={isSel}
                                        className={cn("group absolute outline-none", following ? "cursor-grabbing" : "cursor-grab", !drag && "transition-[left,top,width,height] duration-200")}
                                        style={{ ...r, touchAction: "none", transform: following ? `translate(${drag!.dx}px, ${drag!.dy}px)` : undefined, opacity: following ? 0.85 : 1, zIndex: following ? 30 : isSel ? 20 : 2 }}
                                        onPointerDown={(e) => begin(e, "tile", t, "move")}
                                        onPointerMove={moveTo}
                                        onPointerUp={end}
                                        onPointerCancel={() => setDrag(null)}
                                        onDoubleClick={() => onEdit(t.id)}
                                        onKeyDown={(e) => onKey(e, "tile", t)}
                                        onFocus={() => !isSel && onSelect(t.id)}
                                    >
                                        <div className="pointer-events-none h-full" style={{ boxShadow: following ? "0 30px 60px rgba(0,0,0,.45)" : undefined, borderRadius: 18 }}>
                                            {card}
                                        </div>
                                        {handles("tile", t, isSel, ui)}
                                        {sizeBadge(t.id, ui)}
                                        {toolbarAt(t.id, ui)}
                                    </div>
                                );
                            }}
                        />
                    </div>
                );
            }}
        </ScaledStage>
    );
}
