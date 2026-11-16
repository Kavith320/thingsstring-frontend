"use client";

/** Wall display editor (/wall): tiles, look, sounds and voice, and the public link. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Copy, Pencil, Plus, Trash2, Volume2 } from "lucide-react";
import { ApiError, apiRequest } from "@/lib/api";
import { Button, ColorPicker, Field, Input, Notice, Select } from "@/components/common/ui";
import Switch from "@/components/common/Switch";
import { deviceDisplayName, deviceId, deviceOnline, getPath } from "@/lib/deviceUi";
import { cn, getLastTelemetryMs, isActuatorAuto, toOnOff } from "@/lib/utils";
import {
    DEFAULT_DISPLAY,
    WallConfig,
    WallData,
    WallDisplay,
    WallTile,
    listVoices,
    newId,
    normaliseDisplay,
    playTone,
    announceVoice,
    speechSupported,
    unlockAudio,
} from "@/lib/wall";
import { WallGrid, themeStyle, useWallTheme } from "@/components/wall/WallView";
import { AddTileModal, Segmented, TileEditModal, publishable } from "@/components/wall/WallTileModals";
import WallLinkPanel, { WallMeta } from "@/components/wall/WallLinkPanel";
import { NATURAL_VOICES, isNaturalVoiceDownloaded, loadNaturalVoice, naturalVoiceSupported, speakNatural } from "@/lib/naturalVoice";

const SAMPLE_LINE = "Attention, please. Soil moisture in North greenhouse is critically low, at 18 percent.";

/** Choose a natural voice; each one can be heard first (downloads it once). */
function NaturalVoicePicker({ value, volume, onChange }: { value: string; volume: number; onChange: (id: string) => void }) {
    const [status, setStatus] = useState<Record<string, string>>({});
    const [have, setHave] = useState<Set<string>>(new Set());
    const supported = typeof window === "undefined" || naturalVoiceSupported();

    useEffect(() => {
        let alive = true;
        Promise.all(NATURAL_VOICES.map(async (x) => ((await isNaturalVoiceDownloaded(x.id)) ? x.id : null))).then((ids) => alive && setHave(new Set(ids.filter(Boolean) as string[])));
        return () => {
            alive = false;
        };
    }, []);

    async function listen(id: string) {
        unlockAudio();
        const say = (t: string) => setStatus((s) => ({ ...s, [id]: t }));
        try {
            say("Downloading 0%");
            await loadNaturalVoice(id, (p) => say(p < 100 ? `Downloading ${p}%` : "Getting ready…"));
            setHave((h) => new Set(h).add(id));
            say("Speaking…");
            await speakNatural(SAMPLE_LINE, id, volume);
            say("");
        } catch {
            say("Couldn't load this voice here");
        }
    }

    if (!supported) return <Notice tone="warning">This browser can&apos;t run the natural voice. Screens like this use their own voice instead.</Notice>;

    return (
        <div>
            <div className="mb-3 text-sm font-semibold text-zinc-900 dark:text-white">Voice</div>
            <div role="radiogroup" aria-label="Natural voice" className="grid gap-2 sm:grid-cols-2">
                {NATURAL_VOICES.map((x) => {
                    const on = value === x.id;
                    const st = status[x.id];
                    return (
                        <div
                            key={x.id}
                            className={cn("flex min-w-0 items-center gap-3 rounded-xl border p-3 transition", on ? "border-zinc-900 ring-1 ring-zinc-900 dark:border-white dark:ring-white" : "border-zinc-200 dark:border-zinc-700")}
                        >
                            <button type="button" role="radio" aria-checked={on} onClick={() => onChange(x.id)} className="min-w-0 flex-1 text-left">
                                <div className="text-sm font-semibold text-zinc-900 dark:text-white">{x.name} <span className="font-normal text-zinc-500">· {x.accent}</span></div>
                                <div className="truncate text-xs text-zinc-500" aria-live="polite">{st || `${x.note}${have.has(x.id) ? " · downloaded" : ` · ${x.sizeMb} MB once`}`}</div>
                            </button>
                            <Button className="h-9 shrink-0 px-3" onClick={() => listen(x.id)} aria-label={`Listen to ${x.name}`} disabled={!!st && st !== "Couldn't load this voice here"}>
                                <Volume2 className="h-4 w-4" /> Listen
                            </Button>
                        </div>
                    );
                })}
            </div>
            <p className="mt-3 text-xs text-zinc-500">Runs on the screen itself: free, private, and works offline after the first download. Each screen downloads the voice once, the first time it opens the wall.</p>
        </div>
    );
}

type Tab = "tiles" | "look" | "sound";

const EMPTY: WallConfig = { title: "Wall display", display: DEFAULT_DISPLAY, pages: [{ id: "p1", title: null, tiles: [] }] };

function fromServer(w: any): WallConfig {
    return {
        title: w?.title || "Wall display",
        display: normaliseDisplay(w?.display),
        pages: Array.isArray(w?.pages) && w.pages.length ? w.pages : EMPTY.pages,
    };
}

/** Owner-side preview data, from the device list (same values the screen will show). */
function previewData(config: WallConfig, devices: any[]): WallData {
    const allowed = new Map(publishable(devices).map((d) => [deviceId(d), d]));
    const devs: WallData["devices"] = {};
    const values: WallData["values"] = {};
    for (const [id, d] of allowed) {
        const seen = getLastTelemetryMs(d.last_telemetry);
        devs[id] = { name: deviceDisplayName(d), online: deviceOnline(d), lastSeen: seen ? new Date(seen).toISOString() : null };
    }
    const pages = config.pages.map((p) => ({
        ...p,
        tiles: p.tiles.map((t) => {
            if (!t.deviceId) return t;
            const d = allowed.get(t.deviceId);
            if (!d) return { ...t, unavailable: true };
            if (t.type === "sensor" && t.key) {
                const v = getPath(d.last_telemetry, t.key);
                values[t.id] = v == null || typeof v === "object" ? null : v;
            }
            if (t.type === "actuator" && t.key) {
                const a = d.control?.actuators?.[t.key] ?? d.config?.actuators?.[t.key];
                values[t.id] = a ? { on: toOnOff(a.state ?? a.status ?? a.value ?? a.default?.state) === "ON", auto: isActuatorAuto(a) } : null;
            }
            return { ...t, dev: t.deviceId };
        }),
    }));
    return { wall: { ...config, pages }, devices: devs, values, history: {} };
}

export default function WallEditor() {
    const [state, setState] = useState<"loading" | "ready" | "unsupported" | "error">("loading");
    const [config, setConfig] = useState<WallConfig>(EMPTY);
    const [savedJson, setSavedJson] = useState(JSON.stringify(EMPTY));
    const [meta, setMeta] = useState<WallMeta>({ saved: false, link: null, pin: { enabled: false, updatedAt: null }, screens: 0, lastViewedAt: null });
    const [devices, setDevices] = useState<any[]>([]);
    const [tab, setTab] = useState<Tab>("tiles");
    const [pageIdx, setPageIdx] = useState(0);
    const [selected, setSelected] = useState<string | null>(null);
    const [editing, setEditing] = useState<string | null>(null);
    const [adding, setAdding] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [saved, setSaved] = useState(false);
    const [now, setNow] = useState(() => Date.now());
    const dirty = JSON.stringify(config) !== savedJson;

    const applyMeta = useCallback((r: any, withConfig = false) => {
        setMeta({ saved: !!r.saved, link: r.link || null, pin: r.pin || { enabled: false, updatedAt: null }, screens: r.screens || 0, lastViewedAt: r.lastViewedAt || null });
        if (withConfig) {
            const c = fromServer(r.wall);
            setConfig(c);
            setSavedJson(JSON.stringify(c));
        }
    }, []);

    useEffect(() => {
        let alive = true;
        apiRequest("/api/wall", { quiet: true })
            .then((r: any) => {
                if (!alive) return;
                applyMeta(r, true);
                setState("ready");
            })
            .catch((e) => {
                if (!alive) return;
                setState(e instanceof ApiError && e.status === 404 ? "unsupported" : "error");
                setError(e.message || "Couldn't load the wall.");
            });
        const loadDevices = () =>
            apiRequest("/api/devices", { quiet: true })
                .then((r: any) => alive && setDevices(Array.isArray(r) ? r : r?.devices || []))
                .catch(() => {});
        loadDevices();
        const t = setInterval(loadDevices, 10_000);
        // Screens open / last viewed, without touching unsaved edits
        const m = setInterval(() => apiRequest("/api/wall", { quiet: true }).then((r: any) => alive && applyMeta(r)).catch(() => {}), 20_000);
        const c = setInterval(() => setNow(Date.now()), 1000);
        return () => {
            alive = false;
            clearInterval(t);
            clearInterval(m);
            clearInterval(c);
        };
    }, [applyMeta]);

    useEffect(() => {
        if (!dirty) return;
        const warn = (e: BeforeUnloadEvent) => e.preventDefault();
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [dirty]);

    const page = config.pages[Math.min(pageIdx, config.pages.length - 1)];
    const data = useMemo(() => previewData(config, devices), [config, devices]);
    const previewPage = data.wall.pages[Math.min(pageIdx, data.wall.pages.length - 1)];
    const theme = useWallTheme(config.display.theme);
    const editingTile = page.tiles.find((t) => t.id === editing) || null;

    const setDisplay = (p: Partial<WallDisplay>) => setConfig((c) => ({ ...c, display: { ...c.display, ...p } }));
    const setTiles = (fn: (tiles: WallTile[]) => WallTile[]) =>
        setConfig((c) => ({ ...c, pages: c.pages.map((p, i) => (i === Math.min(pageIdx, c.pages.length - 1) ? { ...p, tiles: fn(p.tiles) } : p)) }));

    async function save(): Promise<boolean> {
        setSaving(true);
        setError("");
        try {
            const r: any = await apiRequest("/api/wall", { method: "PUT", body: config });
            applyMeta(r, true);
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
            return true;
        } catch (e: any) {
            if (e instanceof ApiError && e.code === "WALL_DEVICE_NOT_ALLOWED") {
                setError("Some tiles use devices you no longer own or manage. Remove the tiles marked “Not available” and save again.");
            } else setError(e.message || "Couldn't save.");
            return false;
        } finally {
            setSaving(false);
        }
    }

    function move(id: string, by: number) {
        setTiles((tiles) => {
            const i = tiles.findIndex((t) => t.id === id);
            const j = i + by;
            if (i < 0 || j < 0 || j >= tiles.length) return tiles;
            const out = tiles.slice();
            [out[i], out[j]] = [out[j], out[i]];
            return out;
        });
    }

    if (state === "loading") return <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-800" />)}</div>;
    if (state === "unsupported") return <Notice tone="warning">The server doesn&apos;t support wall displays yet. Update the backend to use this page.</Notice>;
    if (state === "error") return <Notice tone="error">{error}</Notice>;

    const tileCount = config.pages.reduce((n, p) => n + p.tiles.length, 0);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0">
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Wall display</h1>
                    <p className="text-sm text-zinc-500">A full-screen live view for a TV or monitor. Changes light up, and it can beep and read alerts out loud.</p>
                </div>
                <div className="flex items-center gap-2">
                    {dirty ? <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Unsaved changes</span> : saved ? <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Saved</span> : null}
                    <Button variant="primary" onClick={save} loading={saving} disabled={!dirty}>Save</Button>
                </div>
            </div>
            {error && <Notice tone="error">{error}</Notice>}

            <WallLinkPanel meta={meta} onMeta={(r) => applyMeta(r)} beforeCreate={async () => (dirty || !meta.saved ? save() : true)} />

            <Field label="Wall title" className="max-w-md">
                {(id) => <Input id={id} value={config.title} maxLength={80} onChange={(e) => setConfig((c) => ({ ...c, title: e.target.value }))} />}
            </Field>

            {/* Tabs */}
            <div role="tablist" aria-label="Wall settings" className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
                {([
                    ["tiles", `Tiles (${tileCount})`],
                    ["look", "Look"],
                    ["sound", "Sound & voice"],
                ] as [Tab, string][]).map(([id, label]) => (
                    <button
                        key={id}
                        role="tab"
                        type="button"
                        aria-selected={tab === id}
                        onClick={() => setTab(id)}
                        className={cn("-mb-px border-b-2 px-3 py-2.5 text-sm font-semibold", tab === id ? "border-zinc-900 text-zinc-900 dark:border-white dark:text-white" : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200")}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {tab === "tiles" && (
                <div className="space-y-4">
                    {/* Pages */}
                    <div className="flex flex-wrap items-center gap-2">
                        {config.pages.map((p, i) => (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => { setPageIdx(i); setSelected(null); }}
                                className={cn("h-9 rounded-full border px-3 text-sm font-semibold", i === pageIdx ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900" : "border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300")}
                            >
                                {p.title || `Page ${i + 1}`}
                            </button>
                        ))}
                        {config.pages.length < 10 && (
                            <Button variant="ghost" className="h-9" onClick={() => { setConfig((c) => ({ ...c, pages: [...c.pages, { id: newId("p"), title: null, tiles: [] }] })); setPageIdx(config.pages.length); }}>
                                <Plus className="h-4 w-4" /> Page
                            </Button>
                        )}
                    </div>
                    {config.pages.length > 1 && (
                        <div className="flex flex-wrap items-end gap-2">
                            <Field label="Page name" className="w-full max-w-xs">
                                {(id) => <Input id={id} value={page.title || ""} maxLength={60} placeholder={`Page ${pageIdx + 1}`} onChange={(e) => setConfig((c) => ({ ...c, pages: c.pages.map((p, i) => (i === pageIdx ? { ...p, title: e.target.value || null } : p)) }))} />}
                            </Field>
                            <Button variant="danger" onClick={() => { setConfig((c) => ({ ...c, pages: c.pages.filter((_, i) => i !== pageIdx) })); setPageIdx(Math.max(0, pageIdx - 1)); }}>
                                <Trash2 className="h-4 w-4" /> Delete page
                            </Button>
                        </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm text-zinc-500">Live preview. Click a tile to edit, move or remove it.</p>
                        <Button variant="primary" onClick={() => setAdding(true)} disabled={page.tiles.length >= 48}><Plus className="h-4 w-4" /> Add tile</Button>
                    </div>

                    {/* Preview in the wall's own theme */}
                    <div className={cn("overflow-hidden rounded-2xl border border-zinc-200 p-3 sm:p-4 dark:border-zinc-800", theme === "light" ? "wall-light" : "wall-dark")} style={themeStyle(config.display)}>
                        <div className="mb-3 flex items-center justify-between px-1">
                            <div className="truncate text-lg font-semibold">{config.title || "Wall display"}</div>
                            {config.display.showClock && <div className="text-sm font-semibold tabular-nums">{new Date(now).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>}
                        </div>
                        <div className="-mx-1 overflow-x-auto px-1">
                            <div style={{ minWidth: config.display.columns * 150 }}>
                                <WallGrid
                                    data={data}
                                    page={previewPage}
                                    columns={config.display.columns}
                                    now={now}
                                    rowHeight={140}
                                    editor={{
                                        selected,
                                        onSelect: (id) => setSelected((s) => (s === id ? null : id)),
                                        actions: (t) =>
                                            selected === t.id ? (
                                                <div className="flex gap-1 rounded-xl border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
                                                    <ToolBtn label="Edit" onClick={() => setEditing(t.id)}><Pencil className="h-4 w-4" /></ToolBtn>
                                                    <ToolBtn label="Move earlier" onClick={() => move(t.id, -1)}><ArrowLeft className="h-4 w-4" /></ToolBtn>
                                                    <ToolBtn label="Move later" onClick={() => move(t.id, 1)}><ArrowRight className="h-4 w-4" /></ToolBtn>
                                                    <ToolBtn
                                                        label="Duplicate"
                                                        onClick={() => setTiles((tiles) => { const i = tiles.findIndex((x) => x.id === t.id); const copy = { ...tiles[i], id: newId() }; return [...tiles.slice(0, i + 1), copy, ...tiles.slice(i + 1)]; })}
                                                    >
                                                        <Copy className="h-4 w-4" />
                                                    </ToolBtn>
                                                    <ToolBtn label="Remove" onClick={() => { setTiles((tiles) => tiles.filter((x) => x.id !== t.id)); setSelected(null); }}><Trash2 className="h-4 w-4 text-red-600" /></ToolBtn>
                                                </div>
                                            ) : null,
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {tab === "look" && <LookSettings d={config.display} set={setDisplay} />}
            {tab === "sound" && <SoundSettings d={config.display} set={setDisplay} />}

            <AddTileModal
                open={adding}
                onClose={() => setAdding(false)}
                devices={devices}
                onAdd={(tiles, edit) => {
                    setTiles((cur) => [...cur, ...tiles].slice(0, 48));
                    if (edit && tiles[0]) setEditing(tiles[0].id);
                }}
            />
            {editingTile && (
                <TileEditModal
                    key={editingTile.id}
                    tile={editingTile}
                    onClose={() => setEditing(null)}
                    onSave={(t) => { setTiles((tiles) => tiles.map((x) => (x.id === t.id ? t : x))); setEditing(null); }}
                    onDelete={() => { setTiles((tiles) => tiles.filter((x) => x.id !== editingTile.id)); setEditing(null); setSelected(null); }}
                />
            )}
        </div>
    );
}

function ToolBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
    return (
        <button type="button" aria-label={label} title={label} onClick={onClick} className="grid h-8 w-8 place-items-center rounded-lg text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800">
            {children}
        </button>
    );
}

function Row({ title, help, children }: { title: string; help?: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-3 border-b border-zinc-100 py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
            <div className="min-w-0">
                <div className="text-sm font-semibold text-zinc-900 dark:text-white">{title}</div>
                {help && <div className="text-xs text-zinc-500">{help}</div>}
            </div>
            <div className="shrink-0">{children}</div>
        </div>
    );
}

const card = "rounded-2xl border border-zinc-200 bg-white px-4 shadow-sm sm:px-6 dark:border-zinc-800 dark:bg-zinc-900/40";

function LookSettings({ d, set }: { d: WallDisplay; set: (p: Partial<WallDisplay>) => void }) {
    return (
        <div className={card}>
            <Row title="Theme" help="Auto follows the screen's light or dark setting">
                <Segmented value={d.theme} onChange={(v) => set({ theme: v as WallDisplay["theme"] })} options={[{ id: "dark", label: "Dark" }, { id: "light", label: "Light" }, { id: "auto", label: "Auto" }]} />
            </Row>
            <Row title="Highlight colour" help="Used to light up tiles that just changed">
                <ColorPicker value={d.accent} onChange={(v) => set({ accent: v })} />
            </Row>
            <Row title="Columns" help="On wide screens. Phones always use 2.">
                <Segmented value={String(d.columns)} onChange={(v) => set({ columns: Number(v) })} options={[2, 3, 4, 5, 6, 8].map((n) => ({ id: String(n), label: String(n) }))} />
            </Row>
            <Row title="Text size" help={`${Math.round(d.textScale * 100)}%`}>
                <input type="range" min={0.75} max={1.6} step={0.05} value={d.textScale} onChange={(e) => set({ textScale: Number(e.target.value) })} className="w-56 accent-zinc-900 dark:accent-white" aria-label="Text size" />
            </Row>
            <Row title="Clock in the header">
                <Switch checked={d.showClock} onChange={(v) => set({ showClock: v })} ariaLabel="Clock in the header" />
            </Row>
            <Row title="Recent events panel" help="A list of what changed, on screens wider than 1280px. Smaller screens show the latest one briefly.">
                <Switch checked={d.showFeed} onChange={(v) => set({ showFeed: v })} ariaLabel="Recent events panel" />
            </Row>
            <Row title="Highlight changes for" help="How long a tile stays lit after its value changes">
                <Select value={String(d.highlightSec)} onChange={(e) => set({ highlightSec: Number(e.target.value) })} className="w-40" aria-label="Highlight duration">
                    {[2, 4, 6, 10, 20, 30].map((n) => <option key={n} value={n}>{n} seconds</option>)}
                </Select>
            </Row>
            <Row title="Switch pages every" help="With more than one page">
                <Select value={String(d.rotateSec)} onChange={(e) => set({ rotateSec: Number(e.target.value) })} className="w-40" aria-label="Switch pages every">
                    <option value="0">Off</option>
                    {[10, 15, 30, 60, 120, 300].map((n) => <option key={n} value={n}>{n < 60 ? `${n} seconds` : `${n / 60} min`}</option>)}
                </Select>
            </Row>
            <Row title="Screen burn-in protection" help="Moves everything a few pixels every 2 minutes (for TVs and OLED screens)">
                <Switch checked={d.burnInShift} onChange={(v) => set({ burnInShift: v })} ariaLabel="Screen burn-in protection" />
            </Row>
        </div>
    );
}

function SoundSettings({ d, set }: { d: WallDisplay; set: (p: Partial<WallDisplay>) => void }) {
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
    const supported = useRef(false);
    useEffect(() => {
        supported.current = speechSupported();
        if (!supported.current) return;
        const load = () => setVoices(listVoices());
        load();
        window.speechSynthesis.addEventListener("voiceschanged", load);
        return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
    }, []);
    const s = d.sound;
    const v = d.voice;
    const langs = [...new Set(voices.map((x) => x.lang))].sort();

    return (
        <div className="space-y-4">
            <Notice tone="info">A screen plays sound only after someone taps it once (browsers block it otherwise), so the wall shows a “Start with sound” button when it opens.</Notice>
            <div className={card}>
                <Row title="Sound" help="A short tone when something changes">
                    <Switch checked={s.enabled} onChange={(x) => set({ sound: { ...s, enabled: x } })} ariaLabel="Sound" />
                </Row>
                {s.enabled && (
                    <>
                        <Row title="Play for">
                            <Segmented value={s.on} onChange={(x) => set({ sound: { ...s, on: x as "all" | "alerts" } })} options={[{ id: "all", label: "All changes" }, { id: "alerts", label: "Alerts only" }]} />
                        </Row>
                        <Row title="Tone">
                            <div className="flex items-center gap-2">
                                <Segmented value={s.tone} onChange={(x) => set({ sound: { ...s, tone: x as WallDisplay["sound"]["tone"] } })} options={[{ id: "chime", label: "Chime" }, { id: "soft", label: "Soft" }, { id: "beep", label: "Beep" }]} />
                                <Button className="h-9" onClick={() => { unlockAudio(); setTimeout(() => playTone(s.tone, "info", s.volume), 50); }} aria-label="Play tone"><Volume2 className="h-4 w-4" /></Button>
                                <Button className="h-9" onClick={() => { unlockAudio(); setTimeout(() => playTone(s.tone, "critical", s.volume), 50); }}>Alert</Button>
                            </div>
                        </Row>
                        <Row title="Volume" help={`${Math.round(s.volume * 100)}%`}>
                            <input type="range" min={0} max={1} step={0.05} value={s.volume} onChange={(e) => set({ sound: { ...s, volume: Number(e.target.value) } })} className="w-56 accent-zinc-900 dark:accent-white" aria-label="Volume" />
                        </Row>
                    </>
                )}
            </div>

            <div className={card}>
                <Row title="Read changes out loud" help="A voice says what happened, e.g. “Water pump in North greenhouse is now on”">
                    <Switch checked={v.enabled} onChange={(x) => set({ voice: { ...v, enabled: x } })} ariaLabel="Read changes out loud" />
                </Row>
                {v.enabled && (
                    <>
                        <Row title="Read">
                            <Segmented value={v.on} onChange={(x) => set({ voice: { ...v, on: x as "all" | "alerts" } })} options={[{ id: "all", label: "All changes" }, { id: "alerts", label: "Alerts only" }]} />
                        </Row>
                        <Row title="Voice type" help={v.engine === "natural" ? "A smooth, human-sounding voice built into the wall. Sounds the same on every screen." : "Uses the voices of the screen's browser. Quality depends on the device."}>
                            <Segmented
                                value={v.engine}
                                onChange={(x) => set({ voice: { ...v, engine: x as "natural" | "browser" } })}
                                options={[{ id: "natural", label: "Natural (recommended)" }, { id: "browser", label: "Screen's voice" }]}
                            />
                        </Row>
                        {v.engine === "natural" ? (
                            <div className="border-b border-zinc-100 py-4 dark:border-zinc-800">
                                <NaturalVoicePicker value={v.naturalVoice} volume={v.volume} onChange={(id) => set({ voice: { ...v, naturalVoice: id } })} />
                            </div>
                        ) : (
                            <>
                                <Row title="Language" help="Voices depend on the screen's browser and system">
                                    <Select value={v.lang || ""} onChange={(e) => set({ voice: { ...v, lang: e.target.value || null, voiceName: null } })} className="w-56" aria-label="Voice language">
                                        <option value="">English (any)</option>
                                        {langs.map((l) => <option key={l} value={l}>{l}</option>)}
                                    </Select>
                                </Row>
                                <Row title="Voice" help="“Best available” picks the smoothest female voice each screen has">
                                    <Select value={v.voiceName || ""} onChange={(e) => set({ voice: { ...v, voiceName: e.target.value || null } })} className="w-56" aria-label="Voice">
                                        <option value="">Best available</option>
                                        {voices.filter((x) => !v.lang || x.lang === v.lang).map((x) => <option key={x.name} value={x.name}>{x.name}</option>)}
                                    </Select>
                                </Row>
                                <Row title="Speed" help={`${v.rate.toFixed(2)}×`}>
                                    <input type="range" min={0.5} max={1.6} step={0.05} value={v.rate} onChange={(e) => set({ voice: { ...v, rate: Number(e.target.value) } })} className="w-56 accent-zinc-900 dark:accent-white" aria-label="Speed" />
                                </Row>
                                <Row title="Try it">
                                    <Button onClick={() => { unlockAudio(); void announceVoice(SAMPLE_LINE, v); }} disabled={!speechSupported()}>
                                        <Volume2 className="h-4 w-4" /> Test voice
                                    </Button>
                                </Row>
                            </>
                        )}
                        <Row title="Voice volume" help={`${Math.round(v.volume * 100)}%`}>
                            <input type="range" min={0.1} max={1} step={0.05} value={v.volume} onChange={(e) => set({ voice: { ...v, volume: Number(e.target.value) } })} className="w-56 accent-zinc-900 dark:accent-white" aria-label="Voice volume" />
                        </Row>
                    </>
                )}
            </div>

            <div className={card}>
                <Row title="Quiet hours" help="No sound or voice during these hours. Tiles still light up.">
                    <Switch checked={d.quietHours.enabled} onChange={(x) => set({ quietHours: { ...d.quietHours, enabled: x } })} ariaLabel="Quiet hours" />
                </Row>
                {d.quietHours.enabled && (
                    <Row title="From – to">
                        <div className="flex items-center gap-2">
                            <Input type="time" value={d.quietHours.from} onChange={(e) => set({ quietHours: { ...d.quietHours, from: e.target.value || "22:00" } })} className="w-32" aria-label="Quiet from" />
                            <span className="text-zinc-500">–</span>
                            <Input type="time" value={d.quietHours.to} onChange={(e) => set({ quietHours: { ...d.quietHours, to: e.target.value || "06:00" } })} className="w-32" aria-label="Quiet to" />
                        </div>
                    </Row>
                )}
            </div>
        </div>
    );
}
