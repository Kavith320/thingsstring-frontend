"use client";

/**
 * Landing page hero: a device card that runs a small automation story on a loop.
 * Soil moisture dries out, the pump switches on below 30% (with an alert), the soil
 * recovers, the pump switches off. Readings tick and the graph scrolls.
 * Static (no ticking) with prefers-reduced-motion; paused while off-screen or the tab is hidden.
 */
import { useEffect, useRef, useState } from "react";
import { Bell, Droplets, Power, Sprout, Thermometer, Wifi } from "lucide-react";
import { WaterPump } from "@/lib/customIcons";

const HISTORY = 28;
const PUMP_ON_BELOW = 30;
const PUMP_OFF_ABOVE = 46;

interface State {
    soil: number;
    temp: number;
    hum: number;
    rssi: number;
    pump: boolean;
    seen: number;
    history: number[];
    alert: string | null;
}

const INITIAL: State = {
    soil: 34,
    temp: 26.7,
    hum: 71,
    rssi: -55,
    pump: false,
    seen: 1,
    history: Array.from({ length: HISTORY }, (_, i) => 45 - i * 0.4 + Math.sin(i / 2) * 0.8),
    alert: null,
};

const round1 = (n: number) => Math.round(n * 10) / 10;
const jitter = (n: number, by: number, min: number, max: number) => Math.min(max, Math.max(min, n + (Math.random() * 2 - 1) * by));

function step(s: State): State {
    // The automation: dry soil switches the pump on, wet soil switches it off
    const soil = s.pump ? s.soil + 2.2 + Math.random() * 0.6 : s.soil - 0.9 - Math.random() * 0.4;
    let pump = s.pump;
    let alert = s.alert;
    if (!pump && soil < PUMP_ON_BELOW) {
        pump = true;
        alert = "Soil moisture below 30%, pump started";
    } else if (pump && soil > PUMP_OFF_ABOVE) {
        pump = false;
        alert = null;
    }
    return {
        soil: round1(soil),
        temp: round1(jitter(s.temp, 0.15, 25.8, 27.6)),
        hum: Math.round(jitter(s.hum, 1, 66, 76)),
        rssi: Math.round(jitter(s.rssi, 1.2, -61, -50)),
        pump,
        seen: 1,
        history: [...s.history.slice(1), soil],
        alert,
    };
}

export default function LivePreview() {
    const [s, setS] = useState<State>(INITIAL);
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        let visible = true;
        const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { threshold: 0.1 });
        if (rootRef.current) io.observe(rootRef.current);

        let ticks = 0;
        const timer = setInterval(() => {
            if (!visible || document.hidden) return;
            ticks++;
            // New reading every 3rd tick (≈1.8 s); "last seen" counts up in between
            setS((cur) => (ticks % 3 === 0 ? step(cur) : { ...cur, seen: cur.seen + 1 }));
        }, 600);
        return () => {
            clearInterval(timer);
            io.disconnect();
        };
    }, []);

    // Hide the alert a few seconds after it appears
    useEffect(() => {
        if (!s.alert) return;
        const t = setTimeout(() => setS((cur) => ({ ...cur, alert: null })), 4200);
        return () => clearTimeout(t);
    }, [s.alert]);

    const readings = [
        { icon: Thermometer, value: s.temp.toFixed(1), unit: "°C", label: "Temperature" },
        { icon: Droplets, value: String(s.hum), unit: "%", label: "Humidity" },
        { icon: Sprout, value: s.soil.toFixed(0), unit: "%", label: "Soil moisture", warn: s.soil < PUMP_ON_BELOW },
        { icon: Wifi, value: String(s.rssi), unit: "dBm", label: "Signal" },
    ];

    // Graph: soil moisture, 20–50% mapped onto the 80px-high box
    const y = (v: number) => 76 - ((v - 20) / 30) * 70;
    const line = s.history.map((v, i) => `${i === 0 ? "M" : "L"} ${((i / (HISTORY - 1)) * 300).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
    const threshold = y(PUMP_ON_BELOW);

    return (
        <div ref={rootRef} className="relative mx-auto w-full max-w-md lg:max-w-none" aria-label="Example of a live device on the dashboard" role="img">
            <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-2xl shadow-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/40">
                <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"><Sprout className="h-5 w-5" /></span>
                    <div className="min-w-0 flex-1">
                        <div className="font-semibold">North greenhouse</div>
                        <div className="text-xs tabular-nums text-zinc-500">Last seen {s.seen}s ago</div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60 motion-reduce:hidden" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        </span>
                        Online
                    </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                    {readings.map((r) => (
                        <div key={r.label} className="flex items-center gap-2.5 rounded-xl bg-zinc-50 px-3 py-2.5 dark:bg-white/5">
                            <r.icon className={`h-4 w-4 transition-colors ${r.warn ? "text-amber-500" : "text-zinc-400"}`} />
                            <div>
                                <div className="text-sm font-semibold tabular-nums">
                                    <span key={r.value} className="inline-block ts-tick">{r.value}</span>
                                    <span className="ml-0.5 text-xs font-normal text-zinc-500">{r.unit}</span>
                                </div>
                                <div className="text-xs text-zinc-500">{r.label}</div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-4 rounded-xl border border-zinc-100 p-3 dark:border-zinc-800">
                    <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
                        <span>Soil moisture · live</span>
                        <span className="tabular-nums">{s.soil.toFixed(0)}%</span>
                    </div>
                    <svg viewBox="0 0 300 80" className="h-20 w-full overflow-visible text-zinc-800 dark:text-zinc-200" preserveAspectRatio="none" aria-hidden>
                        <defs>
                            <linearGradient id="lp-fill" x1="0" x2="0" y1="0" y2="1">
                                <stop offset="0%" stopColor="currentColor" stopOpacity="0.14" />
                                <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                            </linearGradient>
                        </defs>
                        <line x1="0" x2="300" y1={threshold} y2={threshold} stroke="#f59e0b" strokeWidth="1" strokeDasharray="4 4" opacity="0.7" />
                        <path d={`${line} L 300 80 L 0 80 Z`} fill="url(#lp-fill)" className="ts-path" />
                        <path d={line} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" className="ts-path" vectorEffect="non-scaling-stroke" />
                    </svg>
                    <div className="mt-1 text-right text-[11px] text-amber-600 dark:text-amber-400">Pump starts below 30%</div>
                </div>

                <div className="mt-4 flex items-center justify-between rounded-xl bg-zinc-50 px-3 py-2.5 dark:bg-white/5">
                    <div className="flex items-center gap-2.5">
                        <WaterPump className={`h-5 w-5 transition-colors duration-500 ${s.pump ? "text-sky-600 dark:text-sky-400" : "text-zinc-400"}`} />
                        <div>
                            <div className="text-sm font-semibold">Water pump</div>
                            <div className="text-xs text-zinc-500">{s.pump ? "Running · started by automation" : "Auto · runs when soil < 30%"}</div>
                        </div>
                    </div>
                    <span className={`flex h-7 w-12 items-center rounded-full p-1 transition-colors duration-500 ${s.pump ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"}`}>
                        <span className={`grid h-5 w-5 place-items-center rounded-full bg-white shadow transition-transform duration-500 ${s.pump ? "translate-x-5" : ""}`}>
                            <Power className={`h-3 w-3 ${s.pump ? "text-emerald-600" : "text-zinc-400"}`} />
                        </span>
                    </span>
                </div>
            </div>

            {/* Alert toast (appears when the automation fires) */}
            <div
                aria-hidden
                className={`absolute -top-14 right-2 hidden rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm shadow-xl transition-all duration-500 sm:block dark:border-zinc-800 dark:bg-zinc-900 ${
                    s.alert ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
                }`}
            >
                <div className="flex items-center gap-2 font-semibold"><Bell className="h-4 w-4 text-amber-500" /> Automation ran</div>
                <div className="text-xs text-zinc-500">{s.alert || "Soil moisture below 30%, pump started"}</div>
            </div>
        </div>
    );
}
