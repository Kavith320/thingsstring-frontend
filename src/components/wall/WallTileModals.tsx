"use client";

import { useEffect, useRef, useState } from "react";
import { Activity, AreaChart, BarChart3, Check, Clock3, Gauge as GaugeIcon, Hash, ImageIcon, ImagePlus, LineChart, Loader2, Plus, Power, StickyNote, Trash2, Wifi, X } from "lucide-react";
import { apiRequest, apiUpload, fileUrl } from "@/lib/api";
import { resizeImage } from "@/lib/image";
import { Button, ColorPicker, Field, IconPicker, Input, Modal, Notice, Select, Textarea } from "@/components/common/ui";
import Switch from "@/components/common/Switch";
import { actuatorKeys, deviceDisplayName, deviceId, deviceRole, deviceUi, getPath, sensorKeys } from "@/lib/deviceUi";
import { cn, humanizeKey } from "@/lib/utils";
import { GRAPH_RANGES, GraphSeries, Range, TileSize, TileType, WallGroup, WallTile, newId, tileLabel } from "@/lib/wall";

/** Devices whose data may go on a public wall: the ones you own or manage. */
export function publishable(devices: any[]) {
    return devices.filter((d) => ["owner", "manager"].includes(deviceRole(d)));
}

const TYPES: { id: TileType; label: string; help: string; icon: any }[] = [
    { id: "sensor", label: "Reading", help: "A sensor value: number, gauge or chart", icon: Activity },
    { id: "actuator", label: "Switch", help: "Whether a pump, light, fan… is on", icon: Power },
    { id: "status", label: "Device status", help: "Online or offline", icon: Wifi },
    { id: "clock", label: "Clock", help: "Time and date", icon: Clock3 },
    { id: "graph", label: "Graph", help: "Up to 4 readings over time, from any devices", icon: LineChart },
    { id: "image", label: "Picture", help: "A photo of the farm, factory, a map…", icon: ImageIcon },
    { id: "text", label: "Note", help: "Your own text, e.g. who to call", icon: StickyNote },
];

const SERIES_COLORS = ["#22c55e", "#3b82f6", "#f97316", "#a855f7"];

/* ─────────────────────────────── Add ─────────────────────────────── */

export function AddTileModal({ open, onClose, devices, onAdd }: { open: boolean; onClose: () => void; devices: any[]; onAdd: (tiles: WallTile[], edit?: boolean) => void }) {
    const [type, setType] = useState<TileType | null>(null);
    const [dev, setDev] = useState("");
    const [picked, setPicked] = useState<Set<string>>(new Set());
    const [image, setImage] = useState<string | null>(null);
    const allowed = publishable(devices);
    const hidden = devices.length - allowed.length;
    const device = allowed.find((d) => deviceId(d) === dev);

    const keys: string[] = !device ? [] : type === "sensor" || type === "graph" ? sensorKeys(device.last_telemetry) : type === "actuator" ? actuatorKeys(device) : [];

    function reset() {
        setType(null);
        setDev("");
        setPicked(new Set());
        setImage(null);
    }
    function close() {
        reset();
        onClose();
    }

    function entryFor(d: any, kind: "sensors" | "actuators", key: string) {
        return deviceUi(d)[kind]?.find((e: any) => e.key === key);
    }

    function add() {
        if (!type) return;
        if (type === "clock") onAdd([{ id: newId(), type, size: "m", announce: false }]);
        else if (type === "image") onAdd([{ id: newId(), type, size: "l", image, fit: "cover", announce: false }]);
        else if (type === "graph" && device) {
            const series: GraphSeries[] = [...picked].slice(0, 4).map((key, i) => {
                const e = entryFor(device, "sensors", key);
                return { deviceId: deviceId(device), key, label: e?.label || humanizeKey(key.split(".").pop() || key), unit: e?.unit || null, color: SERIES_COLORS[i] };
            });
            onAdd([{ id: newId(), type: "graph", size: "m", series, rangeH: 24, chart: "area", announce: false }]);
        }
        else if (type === "text") onAdd([{ id: newId(), type, size: "m", text: "", announce: false }], true);
        else if (type === "status") {
            onAdd([...picked].map((id) => ({ id: newId(), type: "status" as const, deviceId: id, size: "s" as TileSize, announce: true })));
        } else if (device) {
            const kind = type === "sensor" ? "sensors" : "actuators";
            onAdd(
                [...picked].map((key) => {
                    const e = entryFor(device, kind, key);
                    return {
                        id: newId(),
                        type,
                        deviceId: deviceId(device),
                        key,
                        label: e?.label || humanizeKey(key.split(".").pop() || key),
                        unit: type === "sensor" ? e?.unit || null : undefined,
                        icon: e?.icon || null,
                        color: e?.color || null,
                        size: "s" as TileSize,
                        style: type === "sensor" ? ("number" as const) : undefined,
                        announce: true,
                    };
                })
            );
        }
        close();
    }

    const canAdd = type === "clock" || type === "text" || (type === "image" ? !!image : type === "graph" ? picked.size > 0 && picked.size <= 4 : picked.size > 0);
    const needsDevice = type === "sensor" || type === "actuator" || type === "graph";

    return (
        <Modal
            open={open}
            onClose={close}
            title={type ? `Add ${TYPES.find((t) => t.id === type)!.label.toLowerCase()}` : "Add a tile"}
            footer={
                <div className="flex w-full justify-between gap-2">
                    {type ? <Button variant="ghost" onClick={reset}>Back</Button> : <span />}
                    <div className="flex gap-2">
                        <Button onClick={close}>Cancel</Button>
                        {type && <Button variant="primary" disabled={!canAdd} onClick={add}>{picked.size > 1 && type !== "graph" ? `Add ${picked.size} tiles` : "Add tile"}</Button>}
                    </div>
                </div>
            }
        >
            {!type ? (
                <div className="grid gap-2 sm:grid-cols-2">
                    {TYPES.map((t) => (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => setType(t.id)}
                            className="flex items-start gap-3 rounded-xl border border-zinc-200 p-3 text-left transition hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:border-zinc-500 dark:hover:bg-zinc-800/50"
                        >
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"><t.icon className="h-4 w-4" /></span>
                            <span>
                                <span className="block text-sm font-semibold text-zinc-900 dark:text-white">{t.label}</span>
                                <span className="block text-xs text-zinc-500">{t.help}</span>
                            </span>
                        </button>
                    ))}
                </div>
            ) : type === "clock" ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">Shows the time and date of the screen it is open on.</p>
            ) : type === "text" ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">You&apos;ll write the text next.</p>
            ) : type === "image" ? (
                <ImagePicker value={image} onChange={setImage} />
            ) : (
                <div className="space-y-4">
                    {!allowed.length && <Notice tone="warning">You don&apos;t own or manage any devices yet.</Notice>}
                    {hidden > 0 && (
                        <p className="text-xs text-zinc-500">
                            {hidden} device{hidden === 1 ? "" : "s"} shared with you as viewer or operator {hidden === 1 ? "isn't" : "aren't"} listed: only an owner or manager can put a device on a public wall.
                        </p>
                    )}
                    {type === "status" ? (
                        <CheckList
                            items={allowed.map((d) => ({ id: deviceId(d), label: deviceDisplayName(d) }))}
                            picked={picked}
                            onChange={setPicked}
                            empty="No devices"
                        />
                    ) : (
                        <>
                            <Field label="Device">
                                {(id) => (
                                    <Select id={id} value={dev} onChange={(e) => { setDev(e.target.value); setPicked(new Set()); }}>
                                        <option value="">Choose a device…</option>
                                        {allowed.map((d) => <option key={deviceId(d)} value={deviceId(d)}>{deviceDisplayName(d)}</option>)}
                                    </Select>
                                )}
                            </Field>
                            {needsDevice && device && (
                                <CheckList
                                    items={keys.map((k) => {
                                        const e = entryFor(device, type === "actuator" ? "actuators" : "sensors", k);
                                        const reading = type !== "actuator";
                                        const raw = reading ? getPath(device.last_telemetry, k) : undefined;
                                        return { id: k, label: e?.label || humanizeKey(k.split(".").pop() || k), hint: reading ? `${k} · now ${raw ?? "—"}${e?.unit ? ` ${e.unit}` : ""}` : k };
                                    })}
                                    picked={picked}
                                    onChange={setPicked}
                                    empty={type === "actuator" ? "This device has no switches." : "This device hasn't sent any readings yet."}
                                />
                            )}
                            {type === "graph" && (
                                <p className={cn("text-xs", picked.size > 4 ? "font-semibold text-red-600" : "text-zinc-500")}>
                                    Pick up to 4 readings for one graph. You can add readings from other devices after, in the tile&apos;s settings.
                                </p>
                            )}
                        </>
                    )}
                </div>
            )}
        </Modal>
    );
}

function CheckList({ items, picked, onChange, empty }: { items: { id: string; label: string; hint?: string }[]; picked: Set<string>; onChange: (s: Set<string>) => void; empty: string }) {
    if (!items.length) return <p className="text-sm text-zinc-500">{empty}</p>;
    const all = items.every((i) => picked.has(i.id));
    return (
        <div>
            <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{picked.size} selected</span>
                <button type="button" className="text-xs font-semibold text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-300" onClick={() => onChange(all ? new Set() : new Set(items.map((i) => i.id)))}>
                    {all ? "Clear" : "Select all"}
                </button>
            </div>
            <ul className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-zinc-200 p-1 dark:border-zinc-700">
                {items.map((i) => (
                    <li key={i.id}>
                        <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                            <input
                                type="checkbox"
                                className="h-4 w-4 accent-zinc-900 dark:accent-white"
                                checked={picked.has(i.id)}
                                onChange={(e) => {
                                    const s = new Set(picked);
                                    if (e.target.checked) s.add(i.id);
                                    else s.delete(i.id);
                                    onChange(s);
                                }}
                            />
                            <span className="min-w-0">
                                <span className="block truncate text-sm font-medium text-zinc-900 dark:text-white">{i.label}</span>
                                {i.hint && <span className="block truncate text-xs text-zinc-500">{i.hint}</span>}
                            </span>
                        </label>
                    </li>
                ))}
            </ul>
        </div>
    );
}

/* ─────────────────────────────── Edit ─────────────────────────────── */

const num = (s: string): number | null => (s.trim() === "" || !Number.isFinite(Number(s)) ? null : Number(s));
const str = (n: number | null | undefined) => (n == null ? "" : String(n));

export function TileEditModal({ tile, devices, onClose, onSave, onDelete }: { tile: WallTile; devices: any[]; onClose: () => void; onSave: (t: WallTile) => void; onDelete: () => void }) {
    const [t, setT] = useState<WallTile>(tile);
    const [warn, setWarn] = useState({ below: str(tile.warn?.below), above: str(tile.warn?.above) });
    const [crit, setCrit] = useState({ below: str(tile.critical?.below), above: str(tile.critical?.above) });
    const [min, setMin] = useState(str(tile.min));
    const [max, setMax] = useState(str(tile.max));
    const set = (p: Partial<WallTile>) => setT((x) => ({ ...x, ...p }));

    const range = (r: { below: string; above: string }): Range | null => {
        const below = num(r.below);
        const above = num(r.above);
        return below == null && above == null ? null : { below, above };
    };
    const gaugeError = (t.style === "gauge" || t.type === "graph") && num(min) != null && num(max) != null && num(min)! >= num(max)! ? "Minimum must be below maximum" : "";

    function save() {
        if (gaugeError) return;
        const out: WallTile = { ...t };
        if (t.type === "sensor") {
            out.warn = range(warn);
            out.critical = range(crit);
            out.min = num(min);
            out.max = num(max);
        }
        if (t.type === "graph") {
            out.min = num(min);
            out.max = num(max);
        }
        onSave(out);
    }

    return (
        <Modal
            open
            onClose={onClose}
            title={`Edit ${tileLabel(tile)}`}
            wide
            footer={
                <div className="flex w-full justify-between gap-2">
                    <Button variant="danger" onClick={onDelete}>Remove</Button>
                    <div className="flex gap-2">
                        <Button onClick={onClose}>Cancel</Button>
                        <Button variant="primary" onClick={save} disabled={!!gaugeError || (t.type === "graph" && !t.series?.length) || (t.type === "image" && !t.image)}>Done</Button>
                    </div>
                </div>
            }
        >
            <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label={t.type === "image" ? "Caption" : "Label"} hint={t.type === "clock" || t.type === "text" || t.type === "image" || t.type === "graph" ? "Optional" : undefined}>
                        {(id) => <Input id={id} value={t.label || ""} maxLength={60} onChange={(e) => set({ label: e.target.value || null })} placeholder={tileLabel({ ...t, label: null })} />}
                    </Field>
                    {t.type === "sensor" && (
                        <Field label="Unit">
                            {(id) => <Input id={id} value={t.unit || ""} maxLength={16} onChange={(e) => set({ unit: e.target.value || null })} placeholder="e.g. °C, %" />}
                        </Field>
                    )}
                </div>

                {t.type === "text" && (
                    <Field label="Text" hint={`${(t.text || "").length}/300`}>
                        {(id) => <Textarea id={id} rows={3} maxLength={300} value={t.text || ""} onChange={(e) => set({ text: e.target.value })} placeholder="e.g. If anything turns red, call Nimal on 077 123 4567" />}
                    </Field>
                )}


                {t.type === "graph" && <GraphSettings t={t} set={set} devices={devices} min={min} max={max} setMin={setMin} setMax={setMax} error={gaugeError} />}

                {t.type === "image" && (
                    <>
                        <ImagePicker value={t.image || null} onChange={(image) => set({ image })} />
                        <div>
                            <div className="mb-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">Fit</div>
                            <Segmented value={t.fit || "cover"} onChange={(v) => set({ fit: v as "cover" | "contain" })} options={[{ id: "cover", label: "Fill the tile" }, { id: "contain", label: "Show it all" }]} />
                        </div>
                    </>
                )}

                {t.type === "sensor" && (
                    <>
                        <div>
                            <div className="mb-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">Show as</div>
                            <Segmented
                                value={t.style || "number"}
                                onChange={(v) => set({ style: v as WallTile["style"] })}
                                options={[
                                    { id: "number", label: "Number", icon: Hash },
                                    { id: "gauge", label: "Gauge", icon: GaugeIcon },
                                    { id: "chart", label: "Chart", icon: LineChart },
                                ]}
                            />
                        </div>
                        <div className="grid gap-4 sm:grid-cols-3">
                            <Field label="Decimals">
                                {(id) => (
                                    <Select id={id} value={t.decimals == null ? "" : String(t.decimals)} onChange={(e) => set({ decimals: e.target.value === "" ? null : Number(e.target.value) })}>
                                        <option value="">Automatic</option>
                                        {[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
                                    </Select>
                                )}
                            </Field>
                            {t.style === "gauge" && (
                                <>
                                    <Field label="Gauge minimum" error={gaugeError}>{(id) => <Input id={id} inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} placeholder="0" />}</Field>
                                    <Field label="Gauge maximum">{(id) => <Input id={id} inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value)} placeholder="100" />}</Field>
                                </>
                            )}
                        </div>
                        <fieldset className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
                            <legend className="px-1 text-sm font-semibold text-zinc-900 dark:text-white">Limits</legend>
                            <p className="mb-3 text-xs text-zinc-500">The tile turns amber or red outside these, and the wall can beep and say it out loud. Leave empty for no limit.</p>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                <Field label="Warn below">{(id) => <Input id={id} inputMode="decimal" value={warn.below} onChange={(e) => setWarn({ ...warn, below: e.target.value })} />}</Field>
                                <Field label="Warn above">{(id) => <Input id={id} inputMode="decimal" value={warn.above} onChange={(e) => setWarn({ ...warn, above: e.target.value })} />}</Field>
                                <Field label="Critical below">{(id) => <Input id={id} inputMode="decimal" value={crit.below} onChange={(e) => setCrit({ ...crit, below: e.target.value })} />}</Field>
                                <Field label="Critical above">{(id) => <Input id={id} inputMode="decimal" value={crit.above} onChange={(e) => setCrit({ ...crit, above: e.target.value })} />}</Field>
                            </div>
                        </fieldset>
                    </>
                )}

                {(t.type === "sensor" || t.type === "actuator" || t.type === "status") && (
                    <div className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-700">
                        <div>
                            <div className="text-sm font-semibold text-zinc-900 dark:text-white">Announce changes</div>
                            <div className="text-xs text-zinc-500">
                                {t.type === "sensor" ? "Sound and voice when this reading crosses a limit" : t.type === "actuator" ? "Sound and voice when it turns on or off" : "Sound and voice when the device goes offline or comes back"}
                            </div>
                        </div>
                        <Switch checked={t.announce !== false} onChange={(v) => set({ announce: v })} ariaLabel="Announce changes" />
                    </div>
                )}

                {t.type !== "image" && (
                    <div>
                        <div className="mb-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">Background</div>
                        <TileBgPicker value={t.bg || null} onChange={(bg) => set({ bg })} />
                        <p className="mt-1.5 text-xs text-zinc-500">Text turns dark or light by itself so it stays easy to read. Alerts still turn the tile amber or red.</p>
                    </div>
                )}

                {(t.type === "sensor" || t.type === "actuator" || t.type === "status") && (
                    <div>
                        <div className="mb-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">Icon size</div>
                        <Segmented
                            value={t.iconSize || "sm"}
                            onChange={(v) => set({ iconSize: v as WallTile["iconSize"] })}
                            options={[{ id: "sm", label: "Small, by the name" }, { id: "md", label: "Big" }, { id: "lg", label: "Huge" }]}
                        />
                        {t.type === "actuator" && (t.iconSize === "md" || t.iconSize === "lg") && <p className="mt-1.5 text-xs text-zinc-500">The icon lights up when it&apos;s on, in place of the switch.</p>}
                    </div>
                )}

                {t.type !== "clock" && t.type !== "image" && t.type !== "graph" && (
                    <div className="grid gap-5 lg:grid-cols-2">
                        <div>
                            <div className="mb-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">Icon colour</div>
                            <ColorPicker value={t.color || null} onChange={(c) => set({ color: c })} />
                        </div>
                        <div>
                            <div className="mb-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">Icon, emoji or your own picture</div>
                            <IconPicker value={t.icon || null} onChange={(i) => set({ icon: i })} />
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
}

export function Segmented({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: { id: string; label: string; icon?: any }[]; label?: string }) {
    return (
        <div role="radiogroup" aria-label={label} className="inline-flex max-w-full flex-wrap gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800/70">
            {options.map((o) => (
                <button
                    key={o.id}
                    type="button"
                    role="radio"
                    aria-checked={value === o.id}
                    onClick={() => onChange(o.id)}
                    className={cn(
                        "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition",
                        value === o.id ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-white" : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                    )}
                >
                    {o.icon && <o.icon className="h-4 w-4" />}
                    {o.label}
                </button>
            ))}
        </div>
    );
}

/* ─────────────────────────────── Pieces ─────────────────────────────── */

/** Tile backgrounds: calm dark tones, bright colours and soft light ones, or any colour. */
const TILE_BGS = [
    "#1e3a8a", "#14532d", "#134e4a", "#581c87", "#7c2d12", "#831843", "#3f3f46", "#0c4a6e",
    "#16a34a", "#2563eb", "#ea580c", "#dc2626", "#ca8a04", "#9333ea",
    "#dcfce7", "#dbeafe", "#fef3c7", "#fee2e2", "#f3e8ff", "#f4f4f5",
];

export function TileBgPicker({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
    const custom = value && !TILE_BGS.includes(value.toLowerCase());
    return (
        <div role="radiogroup" aria-label="Tile background" className="flex flex-wrap items-center gap-2">
            <button
                type="button"
                role="radio"
                aria-checked={!value}
                aria-label="Default"
                title="Default"
                onClick={() => onChange(null)}
                className={cn("grid h-9 w-9 place-items-center rounded-lg border-2 border-dashed border-zinc-300 text-zinc-400 dark:border-zinc-600", !value && "ring-2 ring-zinc-900 ring-offset-2 dark:ring-white dark:ring-offset-zinc-950")}
            >
                <X className="h-4 w-4" />
            </button>
            {TILE_BGS.map((c) => (
                <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={value?.toLowerCase() === c}
                    aria-label={c}
                    title={c}
                    onClick={() => onChange(c)}
                    style={{ background: c }}
                    className={cn("grid h-9 w-9 place-items-center rounded-lg border border-black/10 dark:border-white/10", value?.toLowerCase() === c && "ring-2 ring-zinc-900 ring-offset-2 dark:ring-white dark:ring-offset-zinc-950")}
                >
                    {value?.toLowerCase() === c && <Check className="h-4 w-4 mix-blend-difference text-white" />}
                </button>
            ))}
            <label className={cn("relative grid h-9 cursor-pointer place-items-center rounded-lg border border-zinc-200 px-3 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:text-zinc-200", custom && "ring-2 ring-zinc-900 ring-offset-2 dark:ring-white dark:ring-offset-zinc-950")} style={custom ? { background: value! } : undefined}>
                <span className={custom ? "mix-blend-difference text-white" : ""}>Custom…</span>
                <input type="color" value={value || "#1e3a8a"} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-label="Custom background colour" />
            </label>
        </div>
    );
}

interface UploadedImage {
    id: string;
    ref: string;
}

/** Choose an uploaded picture or upload a new one (shrunk to 1920 px first, so photos fit the 2 MB limit). */
export function ImagePicker({ value, onChange }: { value: string | null; onChange: (ref: string | null) => void }) {
    const [images, setImages] = useState<UploadedImage[] | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        let alive = true;
        apiRequest("/api/files/images", { quiet: true })
            .then((r: any) => alive && setImages(r?.images || []))
            .catch((e) => {
                if (!alive) return;
                setImages([]);
                setError(e.message || "Couldn't load your pictures");
            });
        return () => {
            alive = false;
        };
    }, []);

    async function upload(file: File) {
        setBusy(true);
        setError("");
        try {
            const blob = await resizeImage(file, 1920);
            const r: any = await apiUpload("/api/files/images", blob, "POST");
            setImages((x) => [r.image, ...(x || [])]);
            onChange(r.image.ref);
        } catch (e: any) {
            setError(e.message || "Upload failed");
        } finally {
            setBusy(false);
            if (fileRef.current) fileRef.current.value = "";
        }
    }

    async function remove(img: UploadedImage) {
        try {
            await apiRequest(`/api/files/images/${img.id}`, { method: "DELETE" });
            setImages((x) => (x || []).filter((i) => i.id !== img.id));
            if (value === img.ref) onChange(null);
        } catch (e: any) {
            setError(e.message || "Couldn't delete it");
        }
    }

    return (
        <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Picture</span>
                <Button className="h-9" onClick={() => fileRef.current?.click()} disabled={busy}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} Upload
                </Button>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            </div>
            {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
            {images === null ? (
                <div className="h-24 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
            ) : !images.length ? (
                <button type="button" onClick={() => fileRef.current?.click()} className="grid h-28 w-full place-items-center rounded-xl border-2 border-dashed border-zinc-300 text-sm text-zinc-500 hover:border-zinc-400 dark:border-zinc-700">
                    Upload a photo (PNG, JPEG or WebP)
                </button>
            ) : (
                <div role="radiogroup" aria-label="Your pictures" className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
                    {images.map((img) => {
                        const on = value === img.ref;
                        return (
                            <div key={img.id} className="group relative">
                                <button type="button" role="radio" aria-checked={on} onClick={() => onChange(img.ref)} className={cn("block aspect-[4/3] w-full overflow-hidden rounded-lg border-2", on ? "border-zinc-900 dark:border-white" : "border-transparent")}>
                                    {/* eslint-disable-next-line @next/next/no-img-element -- user upload */}
                                    <img src={fileUrl(img.id)} alt="" className="h-full w-full object-cover" loading="lazy" />
                                </button>
                                <button type="button" aria-label="Delete picture" title="Delete picture" onClick={() => remove(img)} className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-md bg-black/60 text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100">
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

/** Lines, time range and style of a graph tile. */
function GraphSettings({ t, set, devices, min, max, setMin, setMax, error }: { t: WallTile; set: (p: Partial<WallTile>) => void; devices: any[]; min: string; max: string; setMin: (v: string) => void; setMax: (v: string) => void; error: string }) {
    const allowed = publishable(devices);
    const series = t.series || [];
    const [dev, setDev] = useState("");
    const [key, setKey] = useState("");
    const device = allowed.find((d) => deviceId(d) === dev);
    const keys = device ? sensorKeys(device.last_telemetry) : [];
    const setSeries = (s: GraphSeries[]) => set({ series: s });

    function addLine() {
        if (!device || !key || series.length >= 4) return;
        const e = deviceUi(device).sensors?.find((x: any) => x.key === key);
        setSeries([...series, { deviceId: dev, key, label: e?.label || humanizeKey(key.split(".").pop() || key), unit: e?.unit || null, color: SERIES_COLORS.find((c) => !series.some((x) => x.color === c)) || SERIES_COLORS[0] }]);
        setKey("");
    }

    return (
        <>
            <fieldset className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
                <legend className="px-1 text-sm font-semibold text-zinc-900 dark:text-white">Lines ({series.length}/4)</legend>
                <ul className="space-y-2">
                    {series.map((x, i) => {
                        const d = allowed.find((a) => deviceId(a) === x.deviceId);
                        return (
                            <li key={`${x.deviceId}-${x.key}-${i}`} className="flex flex-wrap items-center gap-2">
                                <input type="color" value={x.color || SERIES_COLORS[i]} onChange={(e) => setSeries(series.map((y, j) => (j === i ? { ...y, color: e.target.value } : y)))} className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-zinc-200 bg-transparent p-1 dark:border-zinc-700" aria-label={`Colour of ${x.label || x.key}`} />
                                <Input value={x.label || ""} maxLength={40} onChange={(e) => setSeries(series.map((y, j) => (j === i ? { ...y, label: e.target.value || null } : y)))} className="min-w-0 flex-1" aria-label="Line name" placeholder={x.key} />
                                <Input value={x.unit || ""} maxLength={16} onChange={(e) => setSeries(series.map((y, j) => (j === i ? { ...y, unit: e.target.value || null } : y)))} className="w-20" aria-label="Unit" placeholder="Unit" />
                                <span className="w-full truncate text-xs text-zinc-500 sm:w-auto sm:max-w-40">{d ? deviceDisplayName(d) : "Not available"} · {x.key}</span>
                                <Button variant="ghost" className="h-9 w-9 px-0" onClick={() => setSeries(series.filter((_, j) => j !== i))} aria-label="Remove line"><Trash2 className="h-4 w-4 text-red-600" /></Button>
                            </li>
                        );
                    })}
                </ul>
                {series.length < 4 && (
                    <div className="mt-3 flex flex-wrap items-end gap-2">
                        <Field label="Device" className="min-w-40 flex-1">
                            {(id) => (
                                <Select id={id} value={dev} onChange={(e) => { setDev(e.target.value); setKey(""); }}>
                                    <option value="">Choose…</option>
                                    {allowed.map((d) => <option key={deviceId(d)} value={deviceId(d)}>{deviceDisplayName(d)}</option>)}
                                </Select>
                            )}
                        </Field>
                        <Field label="Reading" className="min-w-40 flex-1">
                            {(id) => (
                                <Select id={id} value={key} onChange={(e) => setKey(e.target.value)} disabled={!device}>
                                    <option value="">Choose…</option>
                                    {keys.map((k) => <option key={k} value={k}>{k}</option>)}
                                </Select>
                            )}
                        </Field>
                        <Button onClick={addLine} disabled={!device || !key}><Plus className="h-4 w-4" /> Add line</Button>
                    </div>
                )}
            </fieldset>
            <div className="flex flex-wrap gap-5">
                <div>
                    <div className="mb-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">Draw as</div>
                    <Segmented
                        value={t.chart || "area"}
                        onChange={(v) => set({ chart: v as WallTile["chart"] })}
                        options={[
                            { id: "area", label: "Area", icon: AreaChart },
                            { id: "line", label: "Line", icon: LineChart },
                            { id: "bar", label: "Bars", icon: BarChart3 },
                        ]}
                    />
                </div>
                <Field label="Time shown" className="w-40">
                    {(id) => (
                        <Select id={id} value={String(t.rangeH || 24)} onChange={(e) => set({ rangeH: Number(e.target.value) })}>
                            {GRAPH_RANGES.map((r) => <option key={r.h} value={r.h}>Last {r.label}</option>)}
                        </Select>
                    )}
                </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Decimals">
                    {(id) => (
                        <Select id={id} value={t.decimals == null ? "" : String(t.decimals)} onChange={(e) => set({ decimals: e.target.value === "" ? null : Number(e.target.value) })}>
                            <option value="">Automatic</option>
                            {[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
                        </Select>
                    )}
                </Field>
                <Field label="Lowest value shown" hint="Empty: automatic" error={error}>{(id) => <Input id={id} inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} />}</Field>
                <Field label="Highest value shown" hint="Empty: automatic">{(id) => <Input id={id} inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value)} />}</Field>
            </div>
        </>
    );
}

/** Name, icon (or emoji, or your own picture) and colour of a group. */
export function GroupEditModal({ group, onClose, onSave, onDelete }: { group: WallGroup; onClose: () => void; onSave: (g: WallGroup) => void; onDelete: () => void }) {
    const [g, setG] = useState<WallGroup>(group);
    return (
        <Modal
            open
            onClose={onClose}
            title="Group"
            footer={
                <div className="flex w-full justify-between gap-2">
                    <Button variant="danger" onClick={onDelete}>Remove group</Button>
                    <div className="flex gap-2">
                        <Button onClick={onClose}>Cancel</Button>
                        <Button variant="primary" onClick={() => onSave({ ...g, label: g.label?.trim() || null })}>Done</Button>
                    </div>
                </div>
            }
        >
            <div className="space-y-5">
                <Field label="Name">{(id) => <Input id={id} value={g.label || ""} maxLength={40} autoFocus onChange={(e) => setG({ ...g, label: e.target.value })} placeholder="e.g. Hall A, Greenhouse 2" />}</Field>
                <div>
                    <div className="mb-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">Colour</div>
                    <ColorPicker value={g.color || null} onChange={(c) => setG({ ...g, color: c })} />
                </div>
                <div>
                    <div className="mb-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">Icon, emoji or your own picture</div>
                    <IconPicker value={g.icon || null} onChange={(i) => setG({ ...g, icon: i })} />
                </div>
                <p className="text-xs text-zinc-500">Tiles inside the group&apos;s frame belong to it and move with it. Removing the group keeps its tiles.</p>
            </div>
        </Modal>
    );
}
