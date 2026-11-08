import type { Metadata } from "next";
import Link from "next/link";
import {
    Activity,
    Bell,
    Bot,
    CalendarClock,
    Download,
    Factory,
    Map as MapIcon,
    Smartphone,
    Sprout,
    Users,
    Workflow,
} from "lucide-react";
import Logo from "@/components/common/Logo";
import IntroLogo from "@/components/landing/IntroLogo";
import { HeaderActions, PrimaryCta } from "@/components/landing/LandingClient";
import { WaterPump } from "@/lib/customIcons";
import LivePreview from "@/components/landing/LivePreview";
import ScrollEffects from "@/components/landing/ScrollEffects";

export const metadata: Metadata = {
    title: "ThingsString: live dashboard and automations for your IoT devices",
    description:
        "See live sensor data, switch outputs, build automations and schedules, share with your team and get alerts. Works on any phone.",
    openGraph: {
        title: "ThingsString",
        description: "Live dashboard, automations and alerts for your sensors and switches.",
        type: "website",
        images: [{ url: "/web-app-manifest-512x512.png", width: 512, height: 512 }],
    },
};

// Runs while the page is parsed, before the logo paints: the intro plays once per device.
const INTRO_SCRIPT = `document.documentElement.classList.add("ts-js");try{if(localStorage.getItem("ts_intro_seen"))document.documentElement.dataset.intro="seen";else localStorage.setItem("ts_intro_seen","1")}catch(e){}`;

const FEATURES = [
    { icon: Activity, title: "Live dashboard", text: "Every sensor reading and output state, refreshed every few seconds, with history graphs from 5 minutes to 7 days." },
    { icon: Workflow, title: "Visual automations", text: "Connect a sensor, a condition and an output: “if soil moisture < 30%, turn the pump on”. No code." },
    { icon: CalendarClock, title: "Schedules", text: "Run outputs every day, on weekdays or every few minutes, for a set time." },
    { icon: Bell, title: "Email alerts", text: "Hear about it when a device goes offline, or when an automation fires." },
    { icon: Users, title: "Share with your team", text: "Invite people by email as viewer, operator or manager. See who switched what in the activity history." },
    { icon: MapIcon, title: "Device map", text: "Place devices on a map and see at a glance which ones are online." },
    { icon: Download, title: "Your data, exportable", text: "Download any device's readings as a CSV file for Excel or your own analysis." },
    { icon: Bot, title: "AI assistant", text: "Ask questions about your devices or switch outputs in plain language." },
];

const STEPS = [
    { title: "Power it on", text: "Plug in your device and open its setup page from your phone." },
    { title: "Connect it", text: "Enter your Wi-Fi details and your ThingsString user ID. That's all the setup there is." },
    { title: "Watch it go live", text: "It appears on your dashboard with its sensors and outputs, ready to control and automate." },
];

const USE_CASES = [
    { icon: Sprout, title: "Greenhouses and irrigation", text: "Track soil moisture, temperature and humidity. Water automatically and get told when a pump stops reporting." },
    { icon: WaterPump, title: "Water tanks and pumps", text: "Watch tank levels and flow, switch valves from your phone, and schedule fills for off-peak hours." },
    { icon: Factory, title: "Machines and workshops", text: "Monitor temperatures, power and run states across sites, and give operators control without giving away the keys." },
];

const FAQ = [
    { q: "What do I need to get started?", a: "A ThingsString-ready device and a Wi-Fi connection. Once it's connected, its sensors and outputs appear on your dashboard by themselves." },
    { q: "Do I need to write code?", a: "No. Automations and schedules are built visually in the app." },
    { q: "Can other people use my devices?", a: "Yes. Invite them by email and choose what they can do: viewers see data, operators can switch outputs, managers can also edit schedules and automations." },
    { q: "What happens if a device goes offline?", a: "Its card turns grey and automations pause for it. Turn on offline alerts for the device to get an email when it drops and when it's back." },
    { q: "How long is data kept?", a: "Readings are kept for 7 days for the live graphs. Download a CSV any time to keep a longer record." },
];

export default function LandingPage() {
    return (
        <div className="min-h-dvh bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
            <script dangerouslySetInnerHTML={{ __html: INTRO_SCRIPT }} />
            <ScrollEffects />

            {/* Header */}
            <header className="ts-header sticky top-0 z-40 border-b border-zinc-200/70 bg-zinc-50/85 backdrop-blur dark:border-zinc-800/70 dark:bg-zinc-950/85">
                <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
                    <Link href="/" className="flex items-center gap-2.5" aria-label="ThingsString home">
                        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#17181a] p-1.5"><IntroLogo className="h-full w-full" /></span>
                        <span className="text-base font-bold tracking-tight">ThingsString</span>
                    </Link>
                    <nav aria-label="Sections" className="hidden items-center gap-6 text-sm font-medium text-zinc-600 md:flex dark:text-zinc-400">
                        <a href="#features" className="hover:text-zinc-900 dark:hover:text-white">Features</a>
                        <a href="#how" className="hover:text-zinc-900 dark:hover:text-white">How it works</a>
                        <a href="#uses" className="hover:text-zinc-900 dark:hover:text-white">Use cases</a>
                        <a href="#faq" className="hover:text-zinc-900 dark:hover:text-white">FAQ</a>
                    </nav>
                    <HeaderActions />
                </div>
            </header>

            <main>
                {/* Hero */}
                <section className="relative isolate overflow-hidden">
                    <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[1.05fr_1fr] lg:pb-24 lg:pt-24">
                        <div className="text-center lg:text-left">
                            <h1 className="ts-intro-text ts-intro-text-2 mt-4 text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
                                Your sensors and switches, <span className="text-zinc-500 dark:text-zinc-400">live in one place</span>
                            </h1>
                            <p className="ts-intro-text ts-intro-text-3 mx-auto mt-5 max-w-xl text-lg leading-relaxed text-zinc-600 lg:mx-0 dark:text-zinc-400">
                                Connect your devices in minutes. Watch readings live, switch outputs from your phone, and let automations and schedules do the routine work.
                            </p>
                            <div className="ts-intro-text ts-intro-text-3 mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
                                <PrimaryCta className="w-full sm:w-auto" />
                                <a href="#how" className="inline-flex h-12 w-full items-center justify-center rounded-2xl border border-zinc-300 px-6 text-base font-semibold text-zinc-800 hover:bg-white sm:w-auto dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900">
                                    See how it works
                                </a>
                            </div>
                            <p className="ts-intro-text ts-intro-text-3 mt-4 flex items-center justify-center gap-1.5 text-sm text-zinc-500 lg:justify-start">
                                <Smartphone className="h-4 w-4" aria-hidden /> Works on your phone, tablet and computer
                            </p>
                        </div>

                        <div data-reveal style={{ "--d": "250ms" } as React.CSSProperties}>
                            <LivePreview />
                        </div>
                    </div>
                </section>

                {/* How it works */}
                <section id="how" className="scroll-mt-20 border-y border-zinc-200 bg-white py-16 sm:py-20 dark:border-zinc-800 dark:bg-zinc-900/40">
                    <div className="mx-auto max-w-6xl px-4 sm:px-6">
                        <SectionTitle eyebrow="How it works" title="From unboxing to a live dashboard in three steps" />
                        <ol className="mt-10 grid gap-4 md:grid-cols-3">
                            {STEPS.map((s, i) => (
                                <li key={s.title} data-reveal style={{ "--d": `${i * 120}ms` } as React.CSSProperties} className="ts-lift relative rounded-2xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-950/50">
                                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-zinc-900 text-sm font-bold text-white dark:bg-white dark:text-zinc-900">{i + 1}</span>
                                    <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                                    <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{s.text}</p>
                                </li>
                            ))}
                        </ol>
                    </div>
                </section>

                {/* Features */}
                <section id="features" className="scroll-mt-20 py-16 sm:py-20">
                    <div className="mx-auto max-w-6xl px-4 sm:px-6">
                        <SectionTitle eyebrow="Features" title="Everything you need to run your devices" />
                        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            {FEATURES.map((f, i) => (
                                <div key={f.title} data-reveal style={{ "--d": `${(i % 4) * 90}ms` } as React.CSSProperties} className="ts-lift rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
                                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"><f.icon className="h-5 w-5" aria-hidden /></span>
                                    <h3 className="mt-4 font-semibold">{f.title}</h3>
                                    <p className="mt-1.5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{f.text}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Use cases */}
                <section id="uses" className="scroll-mt-20 border-y border-zinc-200 bg-white py-16 sm:py-20 dark:border-zinc-800 dark:bg-zinc-900/40">
                    <div className="mx-auto max-w-6xl px-4 sm:px-6">
                        <SectionTitle eyebrow="Use cases" title="Built for farms, homes and workshops" />
                        <div className="mt-10 grid gap-4 md:grid-cols-3">
                            {USE_CASES.map((u, i) => (
                                <div key={u.title} data-reveal style={{ "--d": `${i * 120}ms` } as React.CSSProperties} className="ts-lift rounded-2xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-950/50">
                                    <u.icon className="h-8 w-8 text-zinc-700 dark:text-zinc-300" aria-hidden />
                                    <h3 className="mt-4 text-lg font-semibold">{u.title}</h3>
                                    <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{u.text}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* FAQ */}
                <section id="faq" className="scroll-mt-20 border-t border-zinc-200 bg-white py-16 sm:py-20 dark:border-zinc-800 dark:bg-zinc-900/40">
                    <div className="mx-auto max-w-3xl px-4 sm:px-6">
                        <SectionTitle eyebrow="FAQ" title="Questions people ask" />
                        <div data-reveal className="mt-8 divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-zinc-50 dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950/50">
                            {FAQ.map((f) => (
                                <details key={f.q} className="group p-5 [&_summary::-webkit-details-marker]:hidden">
                                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                                        {f.q}
                                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-zinc-300 text-zinc-500 transition-transform group-open:rotate-45 dark:border-zinc-700" aria-hidden>+</span>
                                    </summary>
                                    <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{f.a}</p>
                                </details>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Closing CTA */}
                <section className="py-16 sm:py-20">
                    <div className="mx-auto max-w-6xl px-4 sm:px-6">
                        <div data-reveal className="relative overflow-hidden rounded-3xl bg-[#17181a] px-6 py-12 text-center text-white sm:px-12">
                            <h2 className="relative text-3xl font-bold tracking-tight sm:text-4xl">Connect your first device today</h2>
                            <p className="relative mx-auto mt-3 max-w-xl text-zinc-400">Set up takes a few minutes. Invite your team when you&apos;re ready.</p>
                            <div className="relative mt-8 flex justify-center">
                                <PrimaryCta />
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="border-t border-zinc-200 py-10 dark:border-zinc-800">
                <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <div className="flex items-center gap-2.5">
                        <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#17181a] p-1.5"><Logo /></span>
                        <span className="font-semibold">ThingsString</span>
                    </div>
                    <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                        <a href="#features" className="hover:text-zinc-900 dark:hover:text-white">Features</a>
                        <a href="#how" className="hover:text-zinc-900 dark:hover:text-white">How it works</a>
                        <a href="#faq" className="hover:text-zinc-900 dark:hover:text-white">FAQ</a>
                        <Link href="/login" className="hover:text-zinc-900 dark:hover:text-white">Sign in</Link>
                    </nav>
                    <p className="text-sm text-zinc-500">© {new Date().getFullYear()} ThingsString</p>
                </div>
            </footer>
        </div>
    );
}

function SectionTitle({ eyebrow, title, align = "center" }: { eyebrow: string; title: string; align?: "center" | "left" }) {
    return (
        <div data-reveal className={align === "center" ? "text-center" : ""}>
            <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">{eyebrow}</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
        </div>
    );
}
