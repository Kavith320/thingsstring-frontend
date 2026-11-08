"use client";

import { useEffect, useState, useRef } from "react";
import { apiRequest } from "@/lib/api";
import { Bot, Sparkles, Send, BrainCircuit, Activity, Cpu, Mic, MicOff } from "lucide-react";
import { cn, manualControlBlockReason, isOnlineFromLastTelemetry } from "@/lib/utils";

/* -------- Types -------- */
interface ChatMessage {
    role: "user" | "assistant";
    content: string;
}

interface SystemMetrics {
    totalDevices: number;
    onlineDevices: number;
    totalSensors: number;
    criticalAlerts: number;
    totalActuators: number;
    activeActuators: number;
}

// Add Web Speech API type definition
declare global {
    interface Window {
        webkitSpeechRecognition: any;
        SpeechRecognition: any;
    }
}

export default function AiPage() {
    const [messages, setMessages] = useState<ChatMessage[]>([
        { role: "assistant", content: "Hello! I'm your IoT System Assistant. You can **speak** to me or type your questions." }
    ]);
    const [input, setInput] = useState("");
    const [thinking, setThinking] = useState(false);
    const [isListening, setIsListening] = useState(false); // Voice state
    const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
    const [fullContext, setFullContext] = useState<any>(null);

    const scrollRef = useRef<HTMLDivElement>(null);
    const recognitionRef = useRef<any>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    // Initialize Speech Recognition
    useEffect(() => {
        if (typeof window !== "undefined") {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (SpeechRecognition) {
                const recognition = new SpeechRecognition();
                recognition.continuous = false;
                recognition.interimResults = false;
                recognition.lang = "en-US";

                recognition.onstart = () => setIsListening(true);

                recognition.onresult = (event: any) => {
                    const transcript = event.results[0][0].transcript;
                    setInput(transcript);
                    // Optional: Auto-send if confident? For now let user review.
                };

                recognition.onerror = (event: any) => {
                    console.error("Speech recognition error", event.error);
                    setIsListening(false);
                };

                recognition.onend = () => setIsListening(false);

                recognitionRef.current = recognition;
            }
        }
    }, []);

    const toggleListening = () => {
        if (!recognitionRef.current) {
            alert("Voice input is not supported in this browser.");
            return;
        }
        if (isListening) {
            recognitionRef.current.stop();
        } else {
            recognitionRef.current.start();
        }
    };

    // Fetch context (System Summary)
    useEffect(() => {
        async function analyzeSystem() {
            try {
                const data: any = await apiRequest("/api/devices", { method: "GET" });
                const list = Array.isArray(data) ? data : (data?.devices || data?.items || []);

                // Store full list for AI context
                setFullContext({ devices: list, timestamp: new Date().toISOString() });

                let online = 0;
                let sensorCount = 0;
                let actuatorsTotal = 0;
                let actuatorsOn = 0;

                list.forEach((d: any) => {
                    const lastTelem = d.last_telemetry || {};
                    if (isOnlineFromLastTelemetry(lastTelem)) online++;

                    for (const k in lastTelem) {
                        const v = lastTelem[k];
                        if (typeof v === 'number' && k !== 'ts' && k !== 'timestamp' && k !== 'created_at') {
                            sensorCount++;
                        }
                    }

                    const acts = d.actuators || d.config?.actuators || {};
                    if (Array.isArray(acts)) {
                        acts.forEach((a: any) => {
                            actuatorsTotal++;
                            const val = a.value || a.state;
                            if (val === 1 || val === true || val === "ON" || val === "high") actuatorsOn++;
                        });
                    } else if (typeof acts === 'object' && acts !== null) {
                        Object.values(acts).forEach((a: any) => {
                            actuatorsTotal++;
                            const val = (typeof a === 'object' && a !== null) ? (a.value || a.state) : a;
                            if (val === 1 || val === true || val === "ON" || val === "high") actuatorsOn++;
                        });
                    }
                });

                setMetrics({
                    totalDevices: list.length,
                    onlineDevices: online,
                    totalSensors: sensorCount,
                    criticalAlerts: list.length - online,
                    totalActuators: actuatorsTotal,
                    activeActuators: actuatorsOn
                });

            } catch (e) {
                console.error("Failed to analyze system", e);
                setMetrics({
                    totalDevices: 0,
                    onlineDevices: 0,
                    totalSensors: 0,
                    criticalAlerts: 0,
                    totalActuators: 0,
                    activeActuators: 0
                });
            }
        }
        analyzeSystem();
        const interval = setInterval(analyzeSystem, 5000);
        return () => clearInterval(interval);
    }, []);

    // HYBRID AI LOGIC
    function tryLocalResponse(text: string): string | null {
        const lower = text.toLowerCase().trim();

        if (['hello', 'hi', 'hey', 'start'].includes(lower)) {
            return "Hello! I'm ready to help. You can ask me to **turn on actuators** or give you a **system summary**.";
        }

        if (['status', 'summary', 'report', 'system status'].some(k => lower.includes(k))) {
            if (!metrics) return "I'm still analyzing the system. Please wait a moment.";
            return `**System Report:**\n` +
                `• **Devices**: ${metrics.totalDevices} total (${metrics.onlineDevices} online)\n` +
                `• **Sensors**: ${metrics.totalSensors} active data points\n` +
                `• **Actuators**: ${metrics.totalActuators} installed (${metrics.activeActuators} ON)\n` +
                `• **Health**: ${metrics.criticalAlerts === 0 ? "✅ Excellent" : "⚠️ Attention Needed"}`;
        }

        if (lower.includes('help') || lower.includes('what can you do')) {
            return "I can:\n1. **Monitor** your sensors (temp, voltage, etc)\n2. **Control** actuators (turn relays ON/OFF)\n3. **Identify** offline devices";
        }

        return null;
    }

    async function handleSend() {
        if (!input.trim()) return;

        const userMsg = input;
        setInput("");
        setMessages(prev => [...prev, { role: "user", content: userMsg }]);
        setThinking(true);

        // OPTIMIZATION: Try local response first
        const localReply = tryLocalResponse(userMsg);
        if (localReply) {
            setTimeout(() => {
                setMessages(prev => [...prev, { role: "assistant", content: localReply }]);
                setThinking(false);
            }, 600);
            return;
        }

        try {
            const res = await fetch("/api/gemini", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: [...messages, { role: "user", content: userMsg }],
                    context: fullContext || { message: "No context loaded yet" }
                })
            });

            const data = await res.json();

            if (res.ok) {
                setMessages(prev => [...prev, { role: "assistant", content: data.message }]);
                if (data.action?.type === "CONTROL") {
                    const { deviceId, actuatorKey, state } = data.action;
                    const blocked = manualControlBlockReason(fullContext?.devices || [], deviceId, actuatorKey);
                    if (blocked) {
                        setMessages(prev => [...prev, { role: "assistant", content: `⚠️ Not executed: ${blocked}` }]);
                        return;
                    }
                    setMessages(prev => [...prev, {
                        role: "assistant",
                        content: `⚡ *Executing command:* Turning **${actuatorKey}** to **${state}** on device \`${deviceId}\`...`
                    }]);

                    try {
                        await apiRequest(`/api/devices/${deviceId}/control`, {
                            method: "POST",
                            body: {
                                actuators: { [actuatorKey]: { state } }
                            }
                        });
                        setMessages(prev => [...prev, { role: "assistant", content: "✅ Success! Command verified." }]);
                    } catch (err: any) {
                        setMessages(prev => [...prev, { role: "assistant", content: `❌ Command Failed: ${err.message}` }]);
                    }
                }
            } else {
                setMessages(prev => [...prev, { role: "assistant", content: `⚠️ Error: ${data.message}` }]);
            }
        } catch (err) {
            setMessages(prev => [...prev, { role: "assistant", content: "I'm having trouble connecting to the AI server right now." }]);
        } finally {
            setThinking(false);
        }
    }

    return (
        <div className="h-[calc(100dvh-56px-32px)] sm:h-[calc(100dvh-64px-48px)] flex flex-col gap-3 sm:gap-5">

            {/* Top: System Summary */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4 shrink-0">
                {[
                    { label: "Actuators on", value: metrics ? `${metrics.activeActuators}/${metrics.totalActuators}` : "–", icon: Activity },
                    { label: "Sensors", value: metrics ? metrics.totalSensors : "–", sub: metrics ? `${metrics.onlineDevices} device${metrics.onlineDevices === 1 ? "" : "s"} online` : "", icon: Cpu },
                    { label: "Assistant", value: "Ready", icon: BrainCircuit, green: true },
                ].map((c) => (
                    <div key={c.label} className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-3 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
                            <c.icon className="hidden sm:block h-4 w-4" aria-hidden />
                            <span className="truncate">{c.label}</span>
                        </div>
                        <div className={cn("mt-1 truncate text-lg sm:text-2xl font-bold", c.green ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-900 dark:text-white")}>
                            {c.value}
                        </div>
                        {c.sub && <div className="hidden sm:block mt-0.5 truncate text-xs text-zinc-500">{c.sub}</div>}
                    </div>
                ))}
            </div>

            {/* Bottom: Chat Interface */}
            <div className="flex-1 min-h-0 rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950/60 shadow-sm flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-3 bg-zinc-50/50 dark:bg-zinc-900/50">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                        <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="text-sm font-semibold text-zinc-900 dark:text-white">Assistant</div>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4" ref={scrollRef}>
                    {messages.map((m, i) => (
                        <div key={i} className={cn("flex w-full", m.role === "user" ? "justify-end" : "justify-start")}>
                            <div className={cn(
                                "max-w-[90%] sm:max-w-[80%] rounded-2xl px-3 py-2 sm:px-4 sm:py-3 text-sm leading-relaxed break-words",
                                m.role === "user"
                                    ? "bg-zinc-900 text-white rounded-br-sm dark:bg-white dark:text-black shadow-md"
                                    : "bg-zinc-100 text-zinc-800 rounded-bl-sm dark:bg-zinc-800/80 dark:text-zinc-200"
                            )}>
                                {/* **bold** as React elements. Never inject the text as HTML: replies
                                    contain device names/data that come from the devices themselves. */}
                                {m.content.split("\n").map((line, li) => (
                                    <p key={li} className="mb-1 last:mb-0">
                                        {line.split(/\*\*(.*?)\*\*/g).map((part, pi) => (pi % 2 ? <b key={pi}>{part}</b> : part))}
                                    </p>
                                ))}
                            </div>
                        </div>
                    ))}
                    {thinking && (
                        <div className="flex justify-start">
                            <div className="bg-zinc-100 dark:bg-zinc-800/80 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:-0.3s]"></span>
                                <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:-0.15s]"></span>
                                <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce"></span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Input */}
                <div className="p-3 sm:p-4 bg-zinc-50/50 dark:bg-zinc-900/30 border-t border-zinc-100 dark:border-zinc-800">
                    <form
                        onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                        className="relative flex items-center shadow-sm gap-2 sm:gap-3"
                    >
                        {/* Voice Input Button */}
                        <button
                            type="button"
                            onClick={toggleListening}
                            className={cn(
                                "p-2 sm:p-3 rounded-2xl transition-all shadow-sm shrink-0",
                                isListening
                                    ? "bg-red-500 text-white animate-pulse"
                                    : "bg-white text-zinc-500 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                            )}
                            title="Voice Input"
                        >
                            {isListening ? <MicOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Mic className="w-4 h-4 sm:w-5 sm:h-5" />}
                        </button>

                        <div className="relative flex-1">
                            <input
                                className="w-full h-10 sm:h-12 rounded-2xl border-none bg-zinc-200/50 pl-4 sm:pl-5 pr-12 sm:pr-14 text-xs sm:text-sm text-zinc-900 focus:ring-2 focus:ring-indigo-500/20 outline-none dark:bg-zinc-900 dark:text-white placeholder:text-zinc-500 transition-all font-medium"
                                placeholder={isListening ? "Listening..." : "Ask me anything..."}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                            />
                            <button
                                type="submit"
                                disabled={!input.trim() || thinking}
                                className="absolute right-1.5 top-1.5 p-1.5 sm:right-2 sm:top-1.5 sm:p-2 rounded-xl bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50 disabled:hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20"
                            >
                                <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
