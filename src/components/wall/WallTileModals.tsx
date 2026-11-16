"use client";

import { useState } from "react";
import { Activity, Clock3, Gauge as GaugeIcon, Hash, LineChart, Power, StickyNote, Wifi } from "lucide-react";
import { Button, ColorPicker, Field, IconPicker, Input, Modal, Notice, Select, Textarea } from "@/components/common/ui";
import Switch from "@/components/common/Switch";
import { actuatorKeys, deviceDisplayName, deviceId, deviceRole, deviceUi, getPath, sensorKeys } from "@/lib/deviceUi";
import { cn, humanizeKey } from "@/lib/utils";
import { Range, SIZE_LABELS, TileSize, TileType, WallTile, newId, tileLabel } from "@/lib/wall";

/** Devices whose data may go on a public wall: the ones you own or manage. */
export function publishable(devices: any[]) {
    return devices.filter((d) => ["owner", "manager"].includes(deviceRole(d)));
}

const TYPES: { id: TileType; label: string; help: string; icon: any }[] = [
    { id: "sensor", label: "Reading", help: "A sensor value: number, gauge or chart", icon: Activity },
    { id: "actuator", label: "Switch", help: "Whether a pump, light, fan… is on", icon: Power },
    { id: "status", label: "Device status", help: "Online or offline", icon: Wifi },
    { id: "clock", label: "Clock", help: "Time and date", icon: Clock3 },
    { id: "text", label: "Note", help: "Your own text, e.g. who to call", icon: StickyNote },
];

/* ─────────────────────────────── Add ─────────────────────────────── */

export function AddTileModal({ open, onClose, devices, onAdd }: { open: boolean; onClose: () => void; devices: any[]; onAdd: (tiles: WallTile[], edit?: boolean) => void }) {
    const [type, setType] = useState<TileType | null>(null);
    const [dev, setDev] = useState("");
    const [picked, setPicked] = useState<Set<string>>(new Set());
    const allowed = publishable(devices);
    const hidden = devices.length - allowed.length;
    const device = allowed.find((d) => deviceId(d) === dev);

    const keys: string[] = !device ? [] : type === "sensor" ? sensorKeys(device.last_telemetry) : type === "actuator" ? actuatorKeys(device) : [];

    function reset() {
        setType(null);
        setDev("");
        setPicked(new Set());
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

    const canAdd = type === "clock" || type === "text" || picked.size > 0;
    const needsDevice = type === "sensor" || type === "actuator";

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
                        {type && <Button variant="primary" disabled={!canAdd} onClick={add}>{picked.size > 1 ? `Add ${picked.size} tiles` : "Add tile"}</Button>}
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
                                        const e = entryFor(device, type === "sensor" ? "sensors" : "actuators", k);
                                        const raw = type === "sensor" ? getPath(device.last_telemetry, k) : undefined;
                                        return { id: k, label: e?.label || humanizeKey(k.split(".").pop() || k), hint: type === "sensor" ? `${k} · now ${raw ?? "—"}${e?.unit ? ` ${e.unit}` : ""}` : k };
                                    })}
                                    picked={picked}
                                    onChange={setPicked}
                                    empty={type === "sensor" ? "This device hasn't sent any readings yet." : "This device has no switches."}
                                />
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

export function TileEditModal({ tile, onClose, onSave, onDelete }: { tile: WallTile; onClose: () => void; onSave: (t: WallTile) => void; onDelete: () => void }) {
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
    const gaugeError = t.style === "gauge" && num(min) != null && num(max) != null && num(min)! >= num(max)! ? "Minimum must be below maximum" : "";

    function save() {
        if (gaugeError) return;
        const out: WallTile = { ...t };
        if (t.type === "sensor") {
            out.warn = range(warn);
            out.critical = range(crit);
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
                        <Button variant="primary" onClick={save} disabled={!!gaugeError}>Done</Button>
                    </div>
                </div>
            }
        >
            <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Label" hint={t.type === "clock" || t.type === "text" ? "Optional" : undefined}>
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

                <div>
                    <div className="mb-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">Size</div>
                    <Segmented
                        value={t.size}
                        onChange={(v) => set({ size: v as TileSize })}
                        options={(Object.keys(SIZE_LABELS) as TileSize[]).map((s) => ({ id: s, label: SIZE_LABELS[s] }))}
                    />
                </div>

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

                {t.type !== "clock" && (
                    <div className="grid gap-5 lg:grid-cols-2">
                        <div>
                            <div className="mb-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">Icon colour</div>
                            <ColorPicker value={t.color || null} onChange={(c) => set({ color: c })} />
                        </div>
                        <div>
                            <div className="mb-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">Icon</div>
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
