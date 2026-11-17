"use client";

/**
 * The public wall screen (/w#<link token>). No login: the link token (and PIN, when the
 * owner set one) is swapped for a 30-day session kept in this browser. Read-only.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, Loader2, Lock, Minimize, Volume2, VolumeX, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    FLOW,
    FeedEvent,
    STAGE,
    StreamStatus,
    WallApiError,
    WallData,
    announceVoice,
    applyUpdate,
    audioReady,
    canvasRects,
    changedTiles,
    connectWall,
    createWallSession,
    diffEvents,
    flowLayout,
    geometry,
    inQuietHours,
    layoutTiles,
    normaliseDisplay,
    playTone,
    stageSize,
    startAudioWhenAllowed,
    unlockAudio,
    wantsAnnounce,
} from "@/lib/wall";
import { ScaledStage, StageHeader, StageTiles, StageToasts, Toast, themeStyle, useWallTheme } from "@/components/wall/WallView";
import { loadNaturalVoice, naturalVoiceSupported } from "@/lib/naturalVoice";

type Phase = "init" | "pin" | "ready" | "gone" | "nolink" | "error";

const SESSION_PREFIX = "ts_wall_session:";
const MUTE_KEY = "ts_wall_muted";
const TOASTS_MAX = 4;

function storeKey(token: string) {
    return SESSION_PREFIX + token.slice(0, 16);
}

function readStored(token: string): string | null {
    try {
        const s = JSON.parse(localStorage.getItem(storeKey(token)) || "null");
        if (s?.session && Date.parse(s.expiresAt) > Date.now() + 60_000) return s.session;
    } catch {}
    return null;
}

function writeStored(token: string, v: { session: string; expiresAt: string } | null) {
    try {
        if (v) localStorage.setItem(storeKey(token), JSON.stringify(v));
        else localStorage.removeItem(storeKey(token));
    } catch {}
}

export default function WallScreen() {
    const [phase, setPhase] = useState<Phase>("init");
    const [token, setToken] = useState("");
    const [session, setSession] = useState<string | null>(null);
    const [title, setTitle] = useState("");
    const [pinError, setPinError] = useState("");
    const [error, setError] = useState("");
    const [data, setData] = useState<WallData | null>(null);
    const dataRef = useRef<WallData | null>(null);
    const [conn, setConn] = useState<StreamStatus>("connecting");
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [flashes, setFlashes] = useState<Record<string, number>>({});
    const [now, setNow] = useState(() => Date.now());
    const [pageIdx, setPageIdx] = useState(0);
    /** sound is playing (false while the browser holds it back until the first tap) */
    const [audioOn, setAudioOn] = useState(false);
    const [muted, setMuted] = useState(false);
    const [idle, setIdle] = useState(false);
    const [full, setFull] = useState(false);
    const [shift, setShift] = useState({ x: 0, y: 0 });
    const [view, setView] = useState({ w: 1280, h: 720 });
    /** natural voice download: null = not needed, 0-100 = loading, "ready", "fallback" */
    const [voiceState, setVoiceState] = useState<number | "ready" | "fallback" | null>(null);

    const display = normaliseDisplay(data?.wall.display);
    const theme = useWallTheme(display.theme);
    const displayRef = useRef(display);
    const mutedRef = useRef(muted);
    useEffect(() => {
        displayRef.current = display;
        mutedRef.current = muted;
    });

    /* ── link token → session ── */

    const exchange = useCallback(async (tok: string, pin?: string) => {
        try {
            const r = await createWallSession(tok, pin);
            writeStored(tok, { session: r.session, expiresAt: r.expiresAt });
            setTitle(r.title);
            setPinError("");
            setSession(r.session);
            setPhase("ready");
        } catch (e: any) {
            if (e instanceof WallApiError) {
                if (e.code === "WALL_PIN_REQUIRED") {
                    setTitle(e.body?.title || "");
                    setPinError("");
                    return setPhase("pin");
                }
                if (e.code === "WALL_PIN_WRONG") {
                    setPinError(e.body?.attemptsLeft != null ? `Wrong PIN. ${e.body.attemptsLeft} tries left.` : "Wrong PIN.");
                    return setPhase("pin");
                }
                if (e.code === "WALL_PIN_LOCKED") {
                    setPinError(e.message);
                    return setPhase("pin");
                }
                if (e.status === 404) return setPhase("gone");
                if (e.status === 429) {
                    setError(e.message);
                    return setPhase("error");
                }
            }
            setError("Can't reach the server. Trying again…");
            setPhase("error");
        }
    }, []);

    useEffect(() => {
        // The link token is after # and browser storage is only readable after hydration
        const tok = window.location.hash.slice(1).trim();
        try {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setMuted(localStorage.getItem(MUTE_KEY) === "1");
        } catch {}
        if (!tok) return setPhase("nolink");
        setToken(tok);
        const stored = readStored(tok);
        if (stored) {
            setSession(stored);
            setPhase("ready");
        } else void exchange(tok);
    }, [exchange]);

    // Retry after a network error
    useEffect(() => {
        if (phase !== "error" || !token) return;
        const t = setTimeout(() => void exchange(token), 10_000);
        return () => clearTimeout(t);
    }, [phase, token, exchange]);

    /* ── announcements ── */

    const announce = useCallback((events: FeedEvent[]) => {
        if (!events.length) return;
        const d = displayRef.current;
        if (d.showFeed) {
            setToasts((t) => [...t, ...events.map((e) => ({ e }))].slice(-TOASTS_MAX));
            const ids = new Set(events.map((e) => e.id));
            const ms = d.notifySec * 1000;
            setTimeout(() => setToasts((t) => t.map((x) => (ids.has(x.e.id) ? { ...x, leaving: true } : x))), ms);
            setTimeout(() => setToasts((t) => t.filter((x) => !ids.has(x.e.id))), ms + 500);
        }
        if (mutedRef.current || inQuietHours(d.quietHours)) return;
        if (d.sound.enabled && audioReady()) {
            const loud = events.filter((e) => wantsAnnounce(e, d.sound.on));
            if (loud.length) {
                const level = loud.some((e) => e.level === "critical") ? "critical" : loud.some((e) => e.level === "warn") ? "warn" : loud[loud.length - 1].level;
                playTone(d.sound.tone, level, d.sound.volume);
            }
        }
        // Not while the browser is still holding sound back: it would all play at once later
        if (d.voice.enabled && audioReady()) {
            const said = events.filter((e) => wantsAnnounce(e, d.voice.on)).map((e) => e.speech);
            if (said.length) setTimeout(() => void announceVoice(said.slice(-3).join(" "), d.voice), d.sound.enabled ? 700 : 0);
        }
    }, []);

    const accept = useCallback(
        (next: WallData) => {
            const prev = dataRef.current;
            dataRef.current = next;
            setData(next);
            if (!prev) return;
            const changed = changedTiles(prev, next);
            if (changed.length) {
                const at = Date.now();
                setFlashes((f) => {
                    const out = { ...f };
                    for (const id of changed) out[id] = at;
                    return out;
                });
            }
            announce(diffEvents(prev, next));
        },
        [announce]
    );

    /* ── live connection ── */

    useEffect(() => {
        if (phase !== "ready" || !session || !token) return;
        const stop = connectWall(session, {
            onSnapshot: (d) => accept(d),
            onUpdate: (u) => dataRef.current && accept(applyUpdate(dataRef.current, u)),
            onStatus: setConn,
            onRevoked: (reason) => {
                writeStored(token, null);
                setSession(null);
                if (reason === "pin" || reason === "expired") void exchange(token);
                else setPhase("gone");
            },
            onAuthError: (e) => {
                writeStored(token, null);
                setSession(null);
                if (e.status === 404) setPhase("gone");
                else void exchange(token);
            },
        });
        return stop;
    }, [phase, session, token, accept, exchange]);

    /* ── clock, idle cursor, size, wake lock, burn-in ── */

    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        const wake = () => {
            setIdle(false);
            clearTimeout(timer);
            timer = setTimeout(() => setIdle(true), 4000);
        };
        wake();
        window.addEventListener("pointermove", wake);
        window.addEventListener("keydown", wake);
        window.addEventListener("touchstart", wake);
        const size = () => setView({ w: window.innerWidth, h: window.innerHeight });
        size();
        window.addEventListener("resize", size);
        const fsChange = () => setFull(!!document.fullscreenElement);
        document.addEventListener("fullscreenchange", fsChange);
        return () => {
            clearTimeout(timer);
            window.removeEventListener("pointermove", wake);
            window.removeEventListener("keydown", wake);
            window.removeEventListener("touchstart", wake);
            window.removeEventListener("resize", size);
            document.removeEventListener("fullscreenchange", fsChange);
        };
    }, []);

    useEffect(() => {
        if (phase !== "ready") return;
        let lock: any = null;
        const request = async () => {
            try {
                if (document.visibilityState === "visible" && "wakeLock" in navigator) lock = await (navigator as any).wakeLock.request("screen");
            } catch {}
        };
        void request();
        document.addEventListener("visibilitychange", request);
        return () => {
            document.removeEventListener("visibilitychange", request);
            lock?.release?.().catch?.(() => {});
        };
    }, [phase]);

    useEffect(() => {
        if (!display.burnInShift) return;
        const t = setInterval(() => setShift({ x: Math.round(Math.random() * 8 - 4), y: Math.round(Math.random() * 8 - 4) }), 120_000);
        return () => clearInterval(t);
    }, [display.burnInShift]);

    /* ── sound: on by itself (no question); the browser may hold it until the first tap ── */

    const wantsSound = phase === "ready" && (display.sound.enabled || display.voice.enabled) && !muted;
    useEffect(() => {
        if (!wantsSound) return;
        return startAudioWhenAllowed(setAudioOn);
    }, [wantsSound]);

    /* ── natural voice: download it straight away ── */

    const wantsNatural = phase === "ready" && display.voice.enabled && display.voice.engine === "natural" && !muted;
    const naturalId = display.voice.naturalVoice;
    useEffect(() => {
        // Unsupported browsers fall back to their own voice (announceVoice does that)
        if (!wantsNatural || !naturalVoiceSupported()) return;
        let alive = true;
        loadNaturalVoice(naturalId, (p) => alive && setVoiceState(p < 100 ? p : "ready"))
            .then(() => alive && setVoiceState("ready"))
            .catch(() => alive && setVoiceState("fallback"));
        return () => {
            alive = false;
        };
    }, [wantsNatural, naturalId]);

    /* ── pages ── */

    const pages = data?.wall.pages || [];
    const page = pages[Math.min(pageIdx, Math.max(0, pages.length - 1))];
    useEffect(() => {
        if (pages.length < 2 || !display.rotateSec) return;
        const t = setInterval(() => setPageIdx((i) => (i + 1) % pages.length), display.rotateSec * 1000);
        return () => clearInterval(t);
    }, [pages.length, display.rotateSec]);
    useEffect(() => {
        const key = (e: KeyboardEvent) => {
            if (pages.length < 2) return;
            if (e.key === "ArrowRight") setPageIdx((i) => (i + 1) % pages.length);
            if (e.key === "ArrowLeft") setPageIdx((i) => (i - 1 + pages.length) % pages.length);
        };
        window.addEventListener("keydown", key);
        return () => window.removeEventListener("keydown", key);
    }, [pages.length]);

    function toggleMute() {
        const m = !muted;
        setMuted(m);
        if (!m) unlockAudio();
        try {
            localStorage.setItem(MUTE_KEY, m ? "1" : "0");
        } catch {}
        if (m && "speechSynthesis" in window) window.speechSynthesis.cancel();
    }

    async function toggleFull() {
        try {
            if (document.fullscreenElement) await document.exitFullscreen();
            else await document.documentElement.requestFullscreen();
        } catch {}
    }

    /* ── render ── */

    const shell = (children: React.ReactNode) => (
        <div className={cn("fixed inset-0 grid place-items-center p-6", theme === "light" ? "wall-light" : "wall-dark")} style={themeStyle(display)}>
            <div className="w-full max-w-sm text-center">{children}</div>
        </div>
    );

    if (phase === "nolink") return shell(<Message title="This link is incomplete" text="Open the full wall link you were given. It ends with a long code after the # sign." />);
    if (phase === "gone") return shell(<Message title="This wall isn't available" text="The link was turned off or replaced. Ask the person who shared it for the new link." />);
    if (phase === "error") return shell(<Message title="Can't connect" text={error} spinner />);
    if (phase === "pin") return shell(<PinForm title={title} error={pinError} onSubmit={(pin) => exchange(token, pin)} />);
    if (phase === "init" || !data || !page) return shell(<Message title="Loading wall…" spinner />);

    /* Layout: the canvas scaled to fit; on a phone where it would be too small to read,
       tiles stack two to a row instead and the page scrolls. */
    const canvas = display.canvas;
    const stage = stageSize(canvas);
    const groups = page.groups || [];
    const { placed } = layoutTiles(page.tiles, canvas.cols, canvas.rows, groups);
    const fitScale = Math.min(view.w / stage.w, view.h / stage.h);
    const flow = view.w < 700 && fitScale < 0.55;
    const flowed = flow ? flowLayout(placed, groups, canvas.cols) : null;
    const laid = flowed || canvasRects(placed, groups, geometry(stage, canvas.cols, canvas.rows));
    const k = flow ? FLOW.header / STAGE.header : 1;
    const pad = flow ? FLOW.pad : STAGE.pad;
    const stageW = flow ? FLOW.width : stage.w;
    const stageH = flowed ? flowed.height : stage.h;
    const sub = pages.length > 1 ? page.title || `Page ${pageIdx + 1} of ${pages.length}` : null;
    const soundOn = display.sound.enabled || display.voice.enabled;
    const blocked = soundOn && !muted && !audioOn;

    return (
        <div className={cn("fixed inset-0", flow ? "overflow-y-auto overflow-x-hidden" : "overflow-hidden", theme === "light" ? "wall-light" : "wall-dark", idle && "cursor-none")} style={themeStyle(display)}>
            <ScaledStage
                w={stageW}
                h={stageH}
                fit={flow ? "width" : "contain"}
                className={flow ? "w-full" : "h-full w-full"}
                style={{ transform: display.burnInShift ? `translate(${shift.x}px, ${shift.y}px)` : undefined, transition: "transform 2s ease" }}
            >
                {() => (
                    <>
                        <StageHeader
                            title={data.wall.title}
                            sub={sub}
                            now={now}
                            showClock={display.showClock}
                            k={k}
                            pad={pad}
                            height={flow ? FLOW.header : STAGE.header}
                            right={
                                <div className="flex shrink-0 items-center" style={{ gap: 18 * k, fontSize: 16 * k, color: "var(--w-muted)" }}>
                                    {typeof voiceState === "number" && (
                                        <span className="flex items-center font-medium" style={{ gap: 6 * k }} role="status">
                                            <Loader2 className="animate-spin" style={{ width: 18 * k, height: 18 * k }} /> Preparing voice {voiceState}%
                                        </span>
                                    )}
                                    {blocked && (
                                        <span className="flex items-center font-medium" style={{ gap: 6 * k, color: "var(--w-warn)" }} title="This browser plays sound only after the screen is touched once">
                                            <VolumeX style={{ width: 18 * k, height: 18 * k }} /> Tap anywhere for sound
                                        </span>
                                    )}
                                    {muted && soundOn && (
                                        <span className="flex items-center font-medium" style={{ gap: 6 * k }}>
                                            <VolumeX style={{ width: 18 * k, height: 18 * k }} /> Muted
                                        </span>
                                    )}
                                    <ConnDot conn={conn} k={k} />
                                </div>
                            }
                        />
                        <StageTiles
                            data={data}
                            items={laid.items}
                            frames={laid.frames}
                            groupScale={flow ? 0.7 : 1}
                            now={now}
                            textScale={display.textScale}
                            flashes={flashes}
                            highlightMs={display.highlightSec * 1000}
                        />
                        {!page.tiles.length && (
                            <div className="absolute inset-x-0 grid place-items-center" style={{ top: STAGE.header, bottom: 0, fontSize: 24, color: "var(--w-faint)" }}>Nothing on this page yet</div>
                        )}
                        {!flow && <StageToasts items={toasts} now={now} stageW={stageW} />}
                    </>
                )}
            </ScaledStage>

            {/* On phones the notifications stay on screen while the page scrolls */}
            {flow && toasts.length > 0 && (
                <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 h-0">
                    <div className="relative mx-auto h-0" style={{ width: Math.min(view.w, 440) }}>
                        <StageToasts items={toasts.slice(-2)} now={now} stageW={Math.min(view.w, 440)} k={0.62} pad={12} />
                    </div>
                </div>
            )}

            {/* Controls: show when the mouse moves or the screen is touched */}
            <div className={cn("fixed bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1.5 rounded-2xl border p-1.5 shadow-xl transition-opacity duration-500", idle ? "pointer-events-none opacity-0" : "opacity-100")} style={{ background: "var(--w-card)", borderColor: "var(--w-border)" }}>
                {pages.length > 1 && (
                    <>
                        <IconBtn label="Previous page" onClick={() => setPageIdx((i) => (i - 1 + pages.length) % pages.length)}><ChevronLeft className="h-4 w-4" /></IconBtn>
                        {pages.map((p, i) => (
                            <button key={p.id} type="button" aria-label={`Page ${i + 1}`} aria-current={i === pageIdx} onClick={() => setPageIdx(i)} className="h-2 rounded-full transition-all" style={{ width: i === pageIdx ? 20 : 8, background: i === pageIdx ? "var(--w-text)" : "var(--w-border)" }} />
                        ))}
                        <IconBtn label="Next page" onClick={() => setPageIdx((i) => (i + 1) % pages.length)}><ChevronRight className="h-4 w-4" /></IconBtn>
                    </>
                )}
                {soundOn && (
                    <IconBtn label={muted ? "Turn sound on" : "Mute"} onClick={toggleMute}>
                        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    </IconBtn>
                )}
                <IconBtn label={full ? "Exit full screen" : "Full screen"} onClick={toggleFull}>
                    {full ? <Minimize className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
                </IconBtn>
            </div>

            {conn === "reconnecting" && (
                <div className="fixed left-1/2 top-3 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-lg" style={{ background: "var(--w-card)", borderColor: "var(--w-warn)", color: "var(--w-warn)" }} role="status">
                    <WifiOff className="h-3.5 w-3.5" /> Connection lost, values may be out of date. Reconnecting…
                </div>
            )}
        </div>
    );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            onClick={onClick}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border"
            style={{ borderColor: "var(--w-border)", background: "var(--w-card)", color: "var(--w-text)" }}
        >
            {children}
        </button>
    );
}

function ConnDot({ conn, k = 1 }: { conn: StreamStatus; k?: number }) {
    const label = conn === "live" ? "Live" : conn === "polling" ? "Updating every 5 s" : conn === "connecting" ? "Connecting" : "Reconnecting";
    const color = conn === "live" ? "var(--w-on)" : conn === "polling" ? "var(--w-accent)" : "var(--w-warn)";
    return (
        <span className="flex items-center font-medium" style={{ gap: 8 * k, color: "var(--w-muted)" }} title={label}>
            <span className="relative flex" style={{ width: 12 * k, height: 12 * k }}>
                {conn === "live" && <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-50 motion-reduce:hidden" style={{ background: color }} />}
                <span className="relative inline-flex h-full w-full rounded-full" style={{ background: color }} />
            </span>
            {label}
        </span>
    );
}

function Message({ title, text, spinner }: { title: string; text?: string; spinner?: boolean }) {
    return (
        <>
            {spinner && <Loader2 className="mx-auto mb-4 h-7 w-7 animate-spin" style={{ color: "var(--w-muted)" }} />}
            <h1 className="text-xl font-semibold">{title}</h1>
            {text && <p className="mt-2 text-sm" style={{ color: "var(--w-muted)" }}>{text}</p>}
        </>
    );
}

function PinForm({ title, error, onSubmit }: { title: string; error: string; onSubmit: (pin: string) => Promise<void> | void }) {
    const [pin, setPin] = useState("");
    const [busy, setBusy] = useState(false);
    return (
        <form
            onSubmit={async (e) => {
                e.preventDefault();
                if (!/^\d{4,8}$/.test(pin)) return;
                setBusy(true);
                await onSubmit(pin);
                setBusy(false);
                setPin("");
            }}
            className="rounded-3xl border p-6"
            style={{ background: "var(--w-card)", borderColor: "var(--w-border)" }}
        >
            <Lock className="mx-auto h-7 w-7" style={{ color: "var(--w-muted)" }} />
            <h1 className="mt-3 text-lg font-semibold">{title || "Wall display"}</h1>
            <p className="mt-1 text-sm" style={{ color: "var(--w-muted)" }}>Enter the PIN to show this wall. This screen will remember it.</p>
            <label htmlFor="wall-pin" className="sr-only">PIN</label>
            <input
                id="wall-pin"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                inputMode="numeric"
                autoComplete="off"
                autoFocus
                className="mt-5 h-14 w-full rounded-xl border bg-transparent text-center text-2xl font-semibold tracking-[0.4em] outline-none"
                style={{ borderColor: error ? "var(--w-crit)" : "var(--w-border)" }}
                aria-invalid={!!error}
                aria-describedby={error ? "wall-pin-error" : undefined}
            />
            {error && <p id="wall-pin-error" className="mt-2 text-sm" style={{ color: "var(--w-crit)" }}>{error}</p>}
            <button type="submit" disabled={busy || pin.length < 4} className="mt-4 h-11 w-full rounded-xl font-semibold disabled:opacity-50" style={{ background: "var(--w-text)", color: "var(--w-bg)" }}>
                {busy ? "Checking…" : "Show wall"}
            </button>
        </form>
    );
}
