"use client";

/**
 * Wall display: a full-screen, read-only dashboard for a big screen, opened through a
 * public link. Backend WALL_FRONTEND_GUIDE.md. Shared by the editor (/wall) and the screen (/w).
 */
import { humanizeKey } from "@/lib/utils";
import { DEFAULT_NATURAL_VOICE, naturalVoiceSupported, setVoiceAudioContext, speakNatural } from "@/lib/naturalVoice";

/* ─────────────────────────────── Types ─────────────────────────────── */

export type TileType = "sensor" | "actuator" | "status" | "clock" | "text";
export type TileSize = "s" | "m" | "l" | "t";
export type SensorStyle = "number" | "gauge" | "chart";
export type Level = "ok" | "warn" | "critical";

export interface Range {
    below?: number | null;
    above?: number | null;
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
    size: TileSize;
    style?: SensorStyle;
    decimals?: number | null;
    min?: number | null;
    max?: number | null;
    warn?: Range | null;
    critical?: Range | null;
    announce?: boolean;
    text?: string | null;
    dev?: string;
    unavailable?: boolean;
}

export interface WallPage {
    id: string;
    title?: string | null;
    tiles: WallTile[];
}

export interface WallDisplay {
    theme: "auto" | "light" | "dark";
    accent: string | null;
    columns: number;
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
    textScale: 1,
    rotateSec: 0,
    showClock: true,
    showFeed: true,
    highlightSec: 6,
    burnInShift: true,
    sound: { enabled: false, on: "all", tone: "chime", volume: 0.6 },
    voice: { enabled: false, on: "all", engine: "natural", naturalVoice: DEFAULT_NATURAL_VOICE, volume: 1, rate: 1, pitch: 1, lang: null, voiceName: null },
    quietHours: { enabled: false, from: "22:00", to: "06:00" },
};

export function normaliseDisplay(d: any): WallDisplay {
    const x = d && typeof d === "object" ? d : {};
    return {
        ...DEFAULT_DISPLAY,
        ...x,
        sound: { ...DEFAULT_DISPLAY.sound, ...(x.sound || {}) },
        voice: { ...DEFAULT_DISPLAY.voice, ...(x.voice || {}) },
        quietHours: { ...DEFAULT_DISPLAY.quietHours, ...(x.quietHours || {}) },
    };
}

export const SIZE_LABELS: Record<TileSize, string> = { s: "Small", m: "Wide", l: "Large", t: "Tall" };
export const SIZE_SPAN: Record<TileSize, { c: number; r: number }> = { s: { c: 1, r: 1 }, m: { c: 2, r: 1 }, l: { c: 2, r: 2 }, t: { c: 1, r: 2 } };

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

/** Apply a stream update to the current state (immutably). */
export function applyUpdate(cur: WallData, u: WallUpdate, keepMs = 60 * 60 * 1000): WallData {
    const history = { ...cur.history };
    const cutoff = Date.now() - keepMs;
    for (const [id, p] of Object.entries(u.points || {})) {
        history[id] = [...(history[id] || []).filter(([t]) => t >= cutoff), p].slice(-240);
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

/** Must be called from a click/tap once: browsers block sound until the page is touched. */
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
