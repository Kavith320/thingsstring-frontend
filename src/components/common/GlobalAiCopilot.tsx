"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  Bot,
  Sparkles,
  Send,
  X,
  Mic,
  MicOff,
  Minimize2,
  Maximize2,
  Trash2,
  Zap,
  CheckCircle2,
  AlertCircle,
  Command,
} from "lucide-react";
import { apiRequest } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  actionExecuted?: string;
  timestamp: string;
}

export default function GlobalAiCopilot() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "init",
      role: "assistant",
      content:
        "Hello! I am **ThingsString AI**. Ask me to control devices, analyze alerts, or check system metrics anytime! (Press `⌘K` to toggle)",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [devicesContext, setDevicesContext] = useState<any[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Toggle drawer via custom event or keyboard shortcut (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        setIsMinimized(false);
      }
    };

    const handleCustomOpen = () => {
      setIsOpen(true);
      setIsMinimized(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("open-ai-copilot", handleCustomOpen);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("open-ai-copilot", handleCustomOpen);
    };
  }, []);

  // Speech Recognition Setup
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = "en-US";

        recognition.onstart = () => setIsListening(true);
        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setInput(transcript);
        };
        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);

        recognitionRef.current = recognition;
      }
    }
  }, []);

  // Fetch device list for AI Context
  useEffect(() => {
    async function loadContext() {
      try {
        const res: any = await apiRequest("/api/devices", { method: "GET" });
        const list = Array.isArray(res) ? res : res?.devices || res?.items || [];
        setDevicesContext(list);
      } catch (err) {
        console.warn("Could not fetch background device list for AI Copilot context:", err);
      }
    }
    if (isOpen) {
      loadContext();
    }
  }, [isOpen]);

  // Auto-scroll chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, thinking]);

  const toggleVoice = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in your browser.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || thinking) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setThinking(true);

    try {
      // Call Gemini API route with device context and route info
      const contextData = {
        currentPage: pathname,
        devices: devicesContext,
      };

      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg],
          context: contextData,
        }),
      });

      const res: any = await response.json();
      if (!response.ok) {
        throw new Error(res.message || `AI Server Error (${response.status})`);
      }

      let actionExecutedText = "";

      // Handle AI-driven Device Control Action
      if (res?.action && res.action.type === "CONTROL") {
        const { deviceId, actuatorKey, state } = res.action;
        try {
          try {
            await apiRequest(`/api/devices/${deviceId}/control`, {
              method: "POST",
              body: { actuators: { [actuatorKey]: { state } } },
            });
          } catch {
            await apiRequest(`/api/devices/${deviceId}/actuators`, {
              method: "POST",
              body: { actuatorKey, state },
            });
          }
          actionExecutedText = `⚡ Action Executed: Set ${actuatorKey} to ${state} on device ${deviceId}`;
        } catch (actErr: any) {
          actionExecutedText = `⚠️ Action Attempted: ${actuatorKey} -> ${state} (${actErr.message || "API Error"})`;
        }
      }

      const replyText = res.message || "Response received.";
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: replyText,
        actionExecuted: actionExecutedText,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `⚠️ Failed to contact AI service: ${err.message || "Unknown error"}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setThinking(false);
    }
  };

  // Get quick prompts based on current page
  const getContextPrompts = () => {
    if (pathname.includes("/devices")) {
      return [
        "Summarize all device statuses",
        "Show offline sensors",
        "Turn off all active actuators",
      ];
    }
    if (pathname.includes("/automation")) {
      return [
        "What automation rules are active?",
        "Suggest a rule to turn off lights at midnight",
      ];
    }
    if (pathname.includes("/settings")) {
      return [
        "How do I configure notification triggers?",
        "System security status",
      ];
    }
    return [
      "Check critical alerts",
      "System health summary",
      "List online devices",
    ];
  };

  return (
    <>
      {/* Floating Action Button (Always Visible when closed or minimized) */}
      {(!isOpen || isMinimized) && (
        <button
          onClick={() => {
            setIsOpen(true);
            setIsMinimized(false);
          }}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-full border border-indigo-500/30 bg-gradient-to-r from-indigo-900/90 via-purple-900/90 to-zinc-900/90 px-4 py-3 text-white shadow-2xl backdrop-blur-xl transition-all duration-300 hover:scale-105 hover:border-indigo-400 hover:shadow-indigo-500/25 active:scale-95 group"
        >
          <div className="relative flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-white shadow-inner">
            <Bot className="h-4 w-4 transition-transform group-hover:rotate-12" />
            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          </div>
          <div className="flex flex-col items-start text-left">
            <span className="text-xs font-bold tracking-wide">ThingsString AI</span>
            <span className="text-[10px] text-indigo-300/80 font-mono flex items-center gap-0.5">
              <Command className="h-2.5 w-2.5" />K
            </span>
          </div>
        </button>
      )}

      {/* Slide-Over AI Copilot Drawer */}
      {isOpen && (
        <div
          className={cn(
            "fixed z-50 transition-all duration-300 ease-in-out shadow-2xl border border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-2xl flex flex-col",
            isMinimized
              ? "bottom-6 right-6 w-80 h-14 rounded-2xl overflow-hidden"
              : "bottom-0 right-0 sm:bottom-6 sm:right-6 w-full sm:w-[420px] h-full sm:h-[620px] sm:rounded-3xl"
          )}
        >
          {/* Drawer Header */}
          <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800/80 px-4 py-3.5 bg-zinc-50/50 dark:bg-zinc-900/50">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-md">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  ThingsString AI
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-semibold text-emerald-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    ONLINE
                  </span>
                </h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 capitalize">
                  Context: {pathname.replace("/", "") || "Home"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setMessages([messages[0]])}
                title="Clear Chat"
                className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              >
                <Trash2 className="h-4 w-4" />
              </button>

              <button
                onClick={() => setIsMinimized((prev) => !prev)}
                title={isMinimized ? "Expand" : "Minimize"}
                className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              >
                {isMinimized ? (
                  <Maximize2 className="h-4 w-4" />
                ) : (
                  <Minimize2 className="h-4 w-4" />
                )}
              </button>

              <button
                onClick={() => setIsOpen(false)}
                title="Close"
                className="p-1.5 text-zinc-400 hover:text-red-500 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Context Action Chips */}
              <div className="p-2.5 border-b border-zinc-200 dark:border-zinc-800/50 bg-zinc-100/40 dark:bg-zinc-900/30 overflow-x-auto flex gap-1.5 scrollbar-none">
                {getContextPrompts().map((promptText, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendMessage(promptText)}
                    disabled={thinking}
                    className="whitespace-nowrap rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-3 py-1 text-xs text-zinc-700 dark:text-zinc-300 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition shadow-sm"
                  >
                    ✨ {promptText}
                  </button>
                ))}
              </div>

              {/* Chat Messages Body */}
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-4"
              >
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex flex-col max-w-[85%] text-xs leading-relaxed",
                      msg.role === "user" ? "ml-auto items-end" : "mr-auto items-start"
                    )}
                  >
                    <div
                      className={cn(
                        "rounded-2xl px-3.5 py-2.5 shadow-sm",
                        msg.role === "user"
                          ? "bg-indigo-600 text-white rounded-br-none"
                          : "bg-zinc-100 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800 rounded-bl-none"
                      )}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>

                      {msg.actionExecuted && (
                        <div className="mt-2 pt-2 border-t border-white/20 dark:border-zinc-700/50 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                          <Zap className="h-3.5 w-3.5 shrink-0" />
                          <span>{msg.actionExecuted}</span>
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] text-zinc-400 mt-1 px-1">
                      {msg.timestamp}
                    </span>
                  </div>
                ))}

                {thinking && (
                  <div className="flex items-center gap-2 text-xs text-indigo-500 font-medium py-2">
                    <Sparkles className="h-4 w-4 animate-spin" />
                    <span>AI Copilot is analyzing system telemetry...</span>
                  </div>
                )}
              </div>

              {/* Chat Input & Controls */}
              <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex items-center gap-2"
                >
                  <button
                    type="button"
                    onClick={toggleVoice}
                    className={cn(
                      "p-2.5 rounded-xl border transition",
                      isListening
                        ? "bg-red-500 text-white border-red-600 animate-pulse"
                        : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                    )}
                    title={isListening ? "Listening..." : "Voice Input"}
                  >
                    {isListening ? (
                      <MicOff className="h-4 w-4" />
                    ) : (
                      <Mic className="h-4 w-4" />
                    )}
                  </button>

                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={
                      isListening
                        ? "Listening to voice prompt..."
                        : "Ask AI Copilot to control or analyze..."
                    }
                    className="flex-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3.5 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />

                  <button
                    type="submit"
                    disabled={!input.trim() || thinking}
                    className="p-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 transition disabled:opacity-50 shadow-md"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
