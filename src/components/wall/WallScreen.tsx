"use client";

/**
 * The public wall screen (/w#<link token>). No login: the link token (and PIN, when the
 * owner set one) is swapped for a 30-day session kept in this browser. Read-only.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, Loader2, Lock, Minimize, Volume2, VolumeX, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    FeedEvent,
    StreamStatus,
    WallApiError,
    WallData,
    announceVoice,
    applyUpdate,
    audioReady,
    changedTiles,
    connectWall,
    createWallSession,
    diffEvents,
    inQuietHours,
    normaliseDisplay,
    playTone,
    unlockAudio,
    wantsAnnounce,
} from "@/lib/wall";
import { FeedList, WallGrid, themeStyle, useWallTheme } from "@/components/wall/WallView";
import { loadNaturalVoice, naturalVoiceSupported } from "@/lib/naturalVoice";

type Phase = "init" | "pin" | "ready" | "gone" | "nolink" | "error";

const SESSION_PREFIX = "ts_wall_session:";
const MUTE_KEY = "ts_wall_muted";
const FEED_MAX = 40;

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
    const [feed, setFeed] = useState<FeedEvent[]>([]);
    const [flashes, setFlashes] = useState<Record<string, number>>({});
    const [now, setNow] = useState(() => Date.now());
    const [pageIdx, setPageIdx] = useState(0);
    const [started, setStarted] = useState(false);
    const [muted, setMuted] = useState(false);
    const [idle, setIdle] = useState(false);
    const [full, setFull] = useState(false);
    const [shift, setShift] = useState({ x: 0, y: 0 });
    const [width, setWidth] = useState(1280);
    const [toast, setToast] = useState<FeedEvent | null>(null);
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
        setFeed((f) => [...events.slice().reverse(), ...f].slice(0, FEED_MAX));
        setToast(events[events.length - 1]);
        const d = displayRef.current;
        if (mutedRef.current || inQuietHours(d.quietHours)) return;
        if (d.sound.enabled && audioReady()) {
            const loud = events.filter((e) => wantsAnnounce(e, d.sound.on));
            if (loud.length) {
                const level = loud.some((e) => e.level === "critical") ? "critical" : loud.some((e) => e.level === "warn") ? "warn" : loud[loud.length - 1].level;
                playTone(d.sound.tone, level, d.sound.volume);
            }
        }
        if (d.voice.enabled) {
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
        const size = () => setWidth(window.innerWidth);
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

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), Math.max(4, display.highlightSec) * 1000);
        return () => clearTimeout(t);
    }, [toast, display.highlightSec]);

    /* ── natural voice: download it as soon as sound is allowed ── */

    const wantsNatural = display.voice.enabled && display.voice.engine === "natural" && started && !muted;
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

    function start() {
        unlockAudio();
        setStarted(true);
    }

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

    const cols = width < 640 ? Math.min(2, display.columns) : width < 1024 ? Math.min(4, display.columns) : display.columns;
    const showFeedPanel = display.showFeed && width >= 1280;
    const needsStart = (display.sound.enabled || display.voice.enabled) && !started && !muted;

    return (
        <div className={cn("fixed inset-0 flex flex-col overflow-hidden", theme === "light" ? "wall-light" : "wall-dark", idle && "cursor-none")} style={themeStyle(display)}>
            <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 sm:p-4" style={{ transform: display.burnInShift ? `translate(${shift.x}px, ${shift.y}px)` : undefined, transition: "transform 2s ease" }}>
                {/* Header */}
                <header className="flex shrink-0 items-center gap-3 px-1">
                    <div className="min-w-0 flex-1">
                        <h1 className="truncate text-lg font-semibold sm:text-xl">{data.wall.title}</h1>
                        {pages.length > 1 && <div className="truncate text-xs" style={{ color: "var(--w-muted)" }}>{page.title || `Page ${pageIdx + 1}`}</div>}
                    </div>
                    {pages.length > 1 && (
                        <div className="flex items-center gap-1.5" aria-label="Pages">
                            <IconBtn label="Previous page" onClick={() => setPageIdx((i) => (i - 1 + pages.length) % pages.length)} hidden={idle}><ChevronLeft className="h-4 w-4" /></IconBtn>
                            {pages.map((p, i) => (
                                <button key={p.id} type="button" aria-label={`Page ${i + 1}`} aria-current={i === pageIdx} onClick={() => setPageIdx(i)} className="h-2 rounded-full transition-all" style={{ width: i === pageIdx ? 20 : 8, background: i === pageIdx ? "var(--w-text)" : "var(--w-border)" }} />
                            ))}
                            <IconBtn label="Next page" onClick={() => setPageIdx((i) => (i + 1) % pages.length)} hidden={idle}><ChevronRight className="h-4 w-4" /></IconBtn>
                        </div>
                    )}
                    {display.showClock && (
                        <div className="hidden text-right tabular-nums sm:block">
                            <div className="text-lg font-semibold leading-none">{new Date(now).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                            <div className="text-xs" style={{ color: "var(--w-muted)" }}>{new Date(now).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}</div>
                        </div>
                    )}
                    {typeof voiceState === "number" && (
                        <span className="hidden items-center gap-1.5 text-xs font-medium sm:flex" style={{ color: "var(--w-muted)" }} role="status">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Preparing voice {voiceState}%
                        </span>
                    )}
                    <ConnDot conn={conn} />
                    {(display.sound.enabled || display.voice.enabled) && (
                        <IconBtn label={muted ? "Turn sound on" : "Mute"} onClick={toggleMute} hidden={idle && !muted}>
                            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                        </IconBtn>
                    )}
                    <IconBtn label={full ? "Exit full screen" : "Full screen"} onClick={toggleFull} hidden={idle}>
                        {full ? <Minimize className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
                    </IconBtn>
                </header>

                {/* Body */}
                <div className="flex min-h-0 flex-1 gap-3">
                    <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
                        <WallGrid data={data} page={page} columns={cols} now={now} flashes={flashes} highlightMs={display.highlightSec * 1000} fill={width >= 640} textScale={display.textScale} />
                    </main>
                    {showFeedPanel && (
                        <aside className="flex w-80 shrink-0 flex-col gap-2 overflow-hidden" aria-label="Recent events">
                            <div className="px-1 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--w-muted)" }}>Recent events</div>
                            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1">
                                <FeedList events={feed} now={now} />
                            </div>
                        </aside>
                    )}
                </div>
            </div>

            {/* Latest event (when the side panel isn't shown) */}
            {!showFeedPanel && toast && (
                <div className="pointer-events-none fixed inset-x-3 bottom-3 z-20 mx-auto max-w-md" role="status">
                    <FeedList events={[toast]} now={now} />
                </div>
            )}

            {conn === "reconnecting" && (
                <div className="fixed left-1/2 top-3 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-lg" style={{ background: "var(--w-card)", borderColor: "var(--w-warn)", color: "var(--w-warn)" }} role="status">
                    <WifiOff className="h-3.5 w-3.5" /> Connection lost, values may be out of date. Reconnecting…
                </div>
            )}

            {needsStart && (
                <div className="fixed inset-0 z-40 grid place-items-center p-6" style={{ background: "var(--w-overlay)" }}>
                    <div className="w-full max-w-sm rounded-3xl border p-6 text-center shadow-2xl" style={{ background: "var(--w-card)", borderColor: "var(--w-border)" }}>
                        <Volume2 className="mx-auto h-8 w-8" />
                        <h2 className="mt-3 text-lg font-semibold">This wall plays sounds</h2>
                        <p className="mt-1 text-sm" style={{ color: "var(--w-muted)" }}>Browsers only allow sound after you tap the page once.</p>
                        <div className="mt-5 flex flex-col gap-2">
                            <button type="button" onClick={start} className="h-11 rounded-xl font-semibold" style={{ background: "var(--w-text)", color: "var(--w-bg)" }} autoFocus>
                                Start with sound
                            </button>
                            <button type="button" onClick={() => { setStarted(true); toggleMute(); }} className="h-11 rounded-xl border font-semibold" style={{ borderColor: "var(--w-border)" }}>
                                Start muted
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function IconBtn({ label, onClick, children, hidden }: { label: string; onClick: () => void; children: React.ReactNode; hidden?: boolean }) {
    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            onClick={onClick}
            className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl border transition-opacity duration-500", hidden && "opacity-0 focus-visible:opacity-100")}
            style={{ borderColor: "var(--w-border)", background: "var(--w-card)", color: "var(--w-text)" }}
        >
            {children}
        </button>
    );
}

function ConnDot({ conn }: { conn: StreamStatus }) {
    const label = conn === "live" ? "Live" : conn === "polling" ? "Updating every 5 s" : conn === "connecting" ? "Connecting" : "Reconnecting";
    const color = conn === "live" ? "var(--w-on)" : conn === "polling" ? "var(--w-accent)" : "var(--w-warn)";
    return (
        <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--w-muted)" }} title={label}>
            <span className="relative flex h-2 w-2">
                {conn === "live" && <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-50 motion-reduce:hidden" style={{ background: color }} />}
                <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: color }} />
            </span>
            <span className="hidden md:inline">{label}</span>
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
