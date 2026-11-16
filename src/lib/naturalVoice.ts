"use client";

/**
 * Natural (neural) voice for the wall display: Piper text-to-speech running in the
 * browser (ONNX Runtime + WebAssembly). Free, no API key, no server load, and the same
 * voice on every screen. The voice model downloads once (~60 MB, from Hugging Face) and
 * is kept in the browser's private storage, so later starts are instant and offline.
 */

export interface NaturalVoice {
    id: string;
    name: string;
    accent: string;
    sizeMb: number;
    note: string;
}

/** Female voices that sound smooth for short announcements. */
export const NATURAL_VOICES: NaturalVoice[] = [
    { id: "en_US-hfc_female-medium", name: "Hannah", accent: "American", sizeMb: 63, note: "Clear and calm" },
    { id: "en_GB-jenny_dioco-medium", name: "Jenny", accent: "British", sizeMb: 63, note: "Warm and soft" },
    { id: "en_US-kristin-medium", name: "Kristin", accent: "American", sizeMb: 63, note: "Bright and friendly" },
    { id: "en_US-amy-medium", name: "Amy", accent: "American", sizeMb: 63, note: "Light and quick" },
    { id: "en_GB-alba-medium", name: "Alba", accent: "Scottish", sizeMb: 63, note: "Gentle" },
    { id: "en_GB-cori-high", name: "Cori", accent: "British", sizeMb: 114, note: "Highest quality, bigger download" },
];

export const DEFAULT_NATURAL_VOICE = NATURAL_VOICES[0].id;

export function naturalVoiceInfo(id: string | null | undefined): NaturalVoice {
    return NATURAL_VOICES.find((v) => v.id === id) || NATURAL_VOICES[0];
}

/** Can this browser run it? (WebAssembly, workers and private file storage) */
export function naturalVoiceSupported(): boolean {
    return typeof window !== "undefined" && typeof WebAssembly === "object" && !!navigator.storage?.getDirectory;
}

type Session = { predict: (text: string) => Promise<Blob> };
let session: Session | null = null;
let sessionVoice: string | null = null;
let loading: Promise<Session> | null = null;

export type LoadProgress = (percent: number) => void;

/** Load (downloading the first time) a voice. Safe to call repeatedly. */
export async function loadNaturalVoice(id: string, onProgress?: LoadProgress): Promise<Session> {
    if (session && sessionVoice === id) return session;
    if (loading && sessionVoice === id) return loading;
    sessionVoice = id;
    loading = (async () => {
        const tts = await import("@mintplex-labs/piper-tts-web");
        // The library keeps one shared session and doesn't reload the model when the voice
        // changes, so start a fresh one for a different voice.
        (tts.TtsSession as any)._instance = null;
        const s = await tts.TtsSession.create({
            voiceId: id,
            progress: (p: { url: string; loaded: number; total: number }) => {
                if (onProgress && p.total && p.url.endsWith(".onnx")) onProgress(Math.min(100, Math.round((p.loaded / p.total) * 100)));
            },
        });
        if (sessionVoice !== id) throw new Error("voice changed");
        session = s;
        onProgress?.(100);
        return s;
    })();
    try {
        return await loading;
    } catch (e) {
        if (sessionVoice === id) {
            session = null;
            sessionVoice = null;
        }
        throw e;
    } finally {
        loading = null;
    }
}

export async function isNaturalVoiceDownloaded(id: string): Promise<boolean> {
    try {
        const tts = await import("@mintplex-labs/piper-tts-web");
        return (await tts.stored()).includes(id);
    } catch {
        return false;
    }
}

/* ─────────────────────────────── Playback ─────────────────────────────── */

let ctx: AudioContext | null = null;
let queue: Promise<void> = Promise.resolve();
let queued = 0;

/** Use the wall's (already unlocked) audio context. */
export function setVoiceAudioContext(c: AudioContext | null) {
    ctx = c;
}

/** Pause between sentences and soften the start/end so it doesn't click. */
async function play(blob: Blob, volume: number) {
    if (!ctx) throw new Error("audio locked");
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    const t = ctx.currentTime + 0.05;
    const v = Math.max(0.0001, Math.min(1, volume));
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(v, t + 0.04);
    gain.gain.setValueAtTime(v, t + Math.max(0.05, buf.duration - 0.08));
    gain.gain.exponentialRampToValueAtTime(0.0001, t + buf.duration);
    src.connect(gain).connect(ctx.destination);
    src.start(t);
    await new Promise<void>((r) => (src.onended = () => r()));
}

/**
 * Speak with a natural voice. Lines are played one after another; if more than two are
 * waiting, the new one is dropped so the screen never talks minutes behind.
 * Rejects when the voice can't be used (the caller falls back to the browser voice).
 */
export function speakNatural(text: string, voiceId: string, volume = 1): Promise<void> {
    if (queued >= 3) return Promise.resolve();
    queued++;
    const job = queue.then(async () => {
        try {
            const s = await loadNaturalVoice(voiceId);
            await play(await s.predict(polish(text)), volume);
        } finally {
            queued--;
        }
    });
    queue = job.catch(() => {});
    return job;
}

/** Small text fixes that make the voice sound more natural. */
export function polish(text: string): string {
    let s = text.replace(/\s+/g, " ").trim();
    s = s.replace(/(\d)\.(\d)/g, "$1 point $2");
    s = s.replace(/(^|[\s,(])-(\d)/g, "$1minus $2");
    if (!/[.!?]$/.test(s)) s += ".";
    return s;
}
