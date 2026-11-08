"use client";

/**
 * Per-user display settings for one device: name, icon, colour, which readings and
 * controls to show (order, labels, units, hidden, pinned to the dashboard) and location.
 * Saved with PATCH /api/devices/:id/ui. Display only: automations, schedules and CSV
 * export still see every value.
 */
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowDown, ArrowUp, Eye, EyeOff, LocateFixed, Pin, PinOff, Radio, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
    actuatorKeys,
    arrangeEntries,
    deviceId as getDeviceId,
    deviceUi,
    sensorKeys,
    toUiEntries,
    type ArrangedEntry,
    type DeviceLocation,
    type DeviceUi,
} from "@/lib/deviceUi";
import { Button, ColorPicker, Field, IconBadge, IconPicker, Input, Modal, Notice, Textarea } from "@/components/common/ui";

const LeafletMap = dynamic(() => import("@/components/map/LeafletMap"), {
    ssr: false,
    loading: () => <div className="grid h-full place-items-center text-sm text-zinc-500">Loading map…</div>,
});

const SECTIONS = ["Look", "Readings", "Controls", "Location"] as const;
type Section = (typeof SECTIONS)[number];

export default function DeviceCustomizeModal({
    device,
    open,
    onClose,
    onSaved,
}: {
    device: any;
    open: boolean;
    onClose: () => void;
    onSaved: (ui: DeviceUi) => void;
}) {
    // Remount the form each time it opens so it starts from the latest saved settings
    if (!open) return null;
    return <CustomizeForm device={device} onClose={onClose} onSaved={onSaved} />;
}

function CustomizeForm({ device, onClose, onSaved }: { device: any; onClose: () => void; onSaved: (ui: DeviceUi) => void }) {
    const id = getDeviceId(device);
    const initial = useMemo(() => deviceUi(device), [device]);
    const firmwareName = device?.config?.device?.name || id;

    const [section, setSection] = useState<Section>("Look");
    const [displayName, setDisplayName] = useState(initial.displayName || "");
    const [description, setDescription] = useState(initial.description || "");
    const [icon, setIcon] = useState<string | null>(initial.icon);
    const [color, setColor] = useState<string | null>(initial.color);
    const [sensors, setSensors] = useState<ArrangedEntry[]>(() =>
        arrangeEntries(sensorKeys(device?.last_telemetry), initial.sensors, { keepMissing: true })
    );
    const [actuators, setActuators] = useState<ArrangedEntry[]>(() =>
        arrangeEntries(actuatorKeys(device), initial.actuators, { keepMissing: true })
    );
    const [location, setLocation] = useState<DeviceLocation | null>(initial.location);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    async function save() {
        if (location && (!(Math.abs(location.lat) <= 90) || !(Math.abs(location.lng) <= 180))) {
            setSection("Location");
            return setError("Latitude must be between -90 and 90, longitude between -180 and 180.");
        }
        setSaving(true);
        setError("");
        try {
            const r: any = await apiRequest(`/api/devices/${encodeURIComponent(id)}/ui`, {
                method: "PATCH",
                body: {
                    displayName: displayName.trim() || null,
                    description: description.trim() || null,
                    icon,
                    color,
                    sensors: toUiEntries(sensors, "sensors"),
                    actuators: toUiEntries(actuators, "actuators"),
                    location: location ? { lat: location.lat, lng: location.lng, label: location.label?.trim() || null, address: location.address || null } : null,
                },
            });
            onSaved({ ...initial, ...(r?.ui || {}) });
            onClose();
        } catch (e: any) {
            setError(/not found/i.test(e.message) && !/device/i.test(e.message)
                ? "Your server doesn't support device display settings yet. Update the backend first."
                : e.message || "Couldn't save the settings.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <Modal
            open
            onClose={onClose}
            title="Device display settings"
            wide
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button variant="primary" onClick={save} loading={saving}>Save</Button>
                </>
            }
        >
            <div role="tablist" aria-label="Settings sections" className="mb-5 grid grid-cols-4 gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900">
                {SECTIONS.map((s) => (
                    <button
                        key={s}
                        type="button"
                        role="tab"
                        aria-selected={section === s}
                        onClick={() => setSection(s)}
                        className={cn("h-9 rounded-lg text-xs sm:text-sm font-semibold", section === s ? "bg-white shadow-sm dark:bg-zinc-800" : "text-zinc-500")}
                    >
                        {s}
                    </button>
                ))}
            </div>

            {section === "Look" && (
                <div className="space-y-5">
                    <div className="flex items-center gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                        <IconBadge icon={icon} color={color} fallback={Radio} size="lg" />
                        <div className="min-w-0">
                            <div className="truncate font-semibold text-zinc-900 dark:text-white">{displayName.trim() || firmwareName}</div>
                            <div className="truncate font-mono text-xs text-zinc-500">{id}</div>
                        </div>
                        <span className="ml-auto text-xs text-zinc-400">Preview</span>
                    </div>
                    <Field label="Name" hint={`Leave empty to use the device's own name (${firmwareName}).`}>
                        {(fid) => <Input id={fid} value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={60} placeholder={firmwareName} />}
                    </Field>
                    <Field label="Description">
                        {(fid) => <Textarea id={fid} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} placeholder="What it does, where it is…" className="min-h-20" />}
                    </Field>
                    <div>
                        <div className="mb-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">Icon</div>
                        <IconPicker value={icon} onChange={setIcon} />
                    </div>
                    <div>
                        <div className="mb-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">Colour</div>
                        <ColorPicker value={color} onChange={setColor} />
                    </div>
                </div>
            )}

            {section === "Readings" && (
                <EntryList
                    kind="sensors"
                    entries={sensors}
                    onChange={setSensors}
                    empty="This device hasn't sent any readings yet."
                    help="Order is the order on the device page. Pinned readings show on the dashboard card (first 4)."
                />
            )}

            {section === "Controls" && (
                <EntryList
                    kind="actuators"
                    entries={actuators}
                    onChange={setActuators}
                    empty="This device has no controllable outputs."
                    help="Hidden controls still run from schedules and automations. Pinned controls show on the dashboard card."
                />
            )}

            {section === "Location" && <LocationEditor value={location} onChange={setLocation} />}

            {error && <Notice tone="error" className="mt-4">{error}</Notice>}
        </Modal>
    );
}

/* ---------------- Readings / controls list ---------------- */
function EntryList({
    kind,
    entries,
    onChange,
    empty,
    help,
}: {
    kind: "sensors" | "actuators";
    entries: ArrangedEntry[];
    onChange: (e: ArrangedEntry[]) => void;
    empty: string;
    help: string;
}) {
    if (!entries.length) return <Notice>{empty}</Notice>;

    const update = (i: number, patch: Partial<ArrangedEntry>) => onChange(entries.map((e, j) => (j === i ? { ...e, ...patch, customised: true } : e)));
    const move = (i: number, dir: -1 | 1) => {
        const j = i + dir;
        if (j < 0 || j >= entries.length) return;
        const next = [...entries];
        [next[i], next[j]] = [next[j], next[i]];
        onChange(next);
    };
    const remove = (i: number) => onChange(entries.filter((_, j) => j !== i));

    return (
        <div>
            <p className="mb-3 text-sm text-zinc-500">{help}</p>
            <ul className="space-y-2">
                {entries.map((e, i) => {
                    return (
                        <li key={e.key} className={cn("rounded-xl border p-3 dark:border-zinc-800", e.visible ? "border-zinc-200" : "border-dashed border-zinc-300 opacity-70 dark:border-zinc-700")}>
                            <div className="flex items-center gap-2">
                                <div className="flex flex-col">
                                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${e.title} up`} className="grid h-7 w-8 place-items-center rounded-md text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800">
                                        <ArrowUp className="h-4 w-4" />
                                    </button>
                                    <button type="button" onClick={() => move(i, 1)} disabled={i === entries.length - 1} aria-label={`Move ${e.title} down`} className="grid h-7 w-8 place-items-center rounded-md text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800">
                                        <ArrowDown className="h-4 w-4" />
                                    </button>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm font-semibold text-zinc-900 dark:text-white">{e.label || e.title}</div>
                                    <div className="truncate font-mono text-xs text-zinc-500">{e.key}</div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => update(i, { visible: !e.visible, pinned: e.visible ? false : e.pinned })}
                                    aria-pressed={!e.visible}
                                    aria-label={e.visible ? `Hide ${e.title}` : `Show ${e.title}`}
                                    title={e.visible ? "Shown (tap to hide)" : "Hidden (tap to show)"}
                                    className={cn("grid h-10 w-10 place-items-center rounded-lg", e.visible ? "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800" : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800")}
                                >
                                    {e.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => update(i, { pinned: !e.pinned, visible: true })}
                                    aria-pressed={e.pinned}
                                    aria-label={e.pinned ? `Unpin ${e.title} from dashboard` : `Pin ${e.title} to dashboard`}
                                    title={e.pinned ? "Pinned to dashboard" : "Pin to dashboard"}
                                    className={cn("grid h-10 w-10 place-items-center rounded-lg", e.pinned ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" : "text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800")}
                                >
                                    {e.pinned ? <Pin className="h-4 w-4" /> : <PinOff className="h-4 w-4" />}
                                </button>
                            </div>
                            <div className={cn("mt-2 grid gap-2 pl-10", kind === "sensors" ? "grid-cols-[1fr_6rem]" : "grid-cols-1")}>
                                <Input
                                    aria-label={`Label for ${e.key}`}
                                    value={e.label || ""}
                                    onChange={(ev) => update(i, { label: ev.target.value || null })}
                                    maxLength={40}
                                    placeholder={e.title}
                                    className="h-10"
                                />
                                {kind === "sensors" && (
                                    <Input
                                        aria-label={`Unit for ${e.key}`}
                                        value={e.unit || ""}
                                        onChange={(ev) => update(i, { unit: ev.target.value || null })}
                                        maxLength={16}
                                        placeholder="Unit"
                                        className="h-10"
                                    />
                                )}
                            </div>
                            {e.customised && (
                                <div className="mt-1 pl-10">
                                    <button type="button" onClick={() => remove(i)} className="text-xs text-zinc-500 underline-offset-2 hover:text-red-600 hover:underline">
                                        Reset to default
                                    </button>
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

/* ---------------- Location ---------------- */
function LocationEditor({ value, onChange }: { value: DeviceLocation | null; onChange: (v: DeviceLocation | null) => void }) {
    const [locating, setLocating] = useState(false);
    const [geoError, setGeoError] = useState("");
    const [latText, setLatText] = useState(value ? String(value.lat) : "");
    const [lngText, setLngText] = useState(value ? String(value.lng) : "");

    function setPoint(lat: number, lng: number) {
        setLatText(String(lat));
        setLngText(String(lng));
        onChange({ ...(value || {}), lat, lng });
    }

    function typed(lat: string, lng: string) {
        setLatText(lat);
        setLngText(lng);
        const a = parseFloat(lat), b = parseFloat(lng);
        if (Number.isFinite(a) && Number.isFinite(b)) onChange({ ...(value || {}), lat: a, lng: b });
    }

    function useMyLocation() {
        if (!navigator.geolocation) return setGeoError("Location isn't available in this browser.");
        setLocating(true);
        setGeoError("");
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setLocating(false);
                setPoint(+pos.coords.latitude.toFixed(6), +pos.coords.longitude.toFixed(6));
            },
            (err) => {
                setLocating(false);
                setGeoError(err.code === err.PERMISSION_DENIED ? "Location permission was denied." : "Couldn't get your location. Try again outdoors or tap the map.");
            },
            { enableHighAccuracy: true, timeout: 15000 }
        );
    }

    return (
        <div className="space-y-4">
            <p className="text-sm text-zinc-500">Tap the map to place the device, drag the pin to adjust, or stand next to it and use your phone&apos;s location.</p>
            <div className="h-64 overflow-hidden rounded-xl border border-zinc-200 sm:h-80 dark:border-zinc-800">
                <LeafletMap picked={value ? { lat: value.lat, lng: value.lng } : null} onPick={setPoint} className="h-full w-full" />
            </div>
            <div className="flex flex-wrap gap-2">
                <Button onClick={useMyLocation} loading={locating}>
                    <LocateFixed className="h-4 w-4" /> Use my location
                </Button>
                {value && (
                    <Button variant="ghost" onClick={() => { onChange(null); setLatText(""); setLngText(""); }}>
                        <Trash2 className="h-4 w-4" /> Remove location
                    </Button>
                )}
            </div>
            {geoError && <Notice tone="warning">{geoError}</Notice>}
            <div className="grid grid-cols-2 gap-3">
                <Field label="Latitude">{(fid) => <Input id={fid} inputMode="decimal" value={latText} onChange={(e) => typed(e.target.value, lngText)} placeholder="6.9271" />}</Field>
                <Field label="Longitude">{(fid) => <Input id={fid} inputMode="decimal" value={lngText} onChange={(e) => typed(latText, e.target.value)} placeholder="79.8612" />}</Field>
            </div>
            <Field label="Place name">
                {(fid) => (
                    <Input
                        id={fid}
                        value={value?.label || ""}
                        onChange={(e) => value && onChange({ ...value, label: e.target.value })}
                        maxLength={60}
                        disabled={!value}
                        placeholder={value ? "e.g. North greenhouse" : "Set a location first"}
                    />
                )}
            </Field>
        </div>
    );
}
