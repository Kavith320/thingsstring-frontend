"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getToken } from "@/lib/auth/storage";
import { ArrowRight, Cpu, Globe, Shield, Zap } from "lucide-react";
import LoadingSignal from "@/components/LoadingSignal";
import dynamic from "next/dynamic";

const SimpleDotsBackground = dynamic(() => import("@/components/common/SimpleDotsBackground"), { ssr: false });
const LogoSplash = dynamic(() => import("@/components/common/LogoSplash"), { ssr: false });
import Logo from "@/components/common/Logo";

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showSplash, setShowSplash] = useState(false);

  useEffect(() => {
    setMounted(true);
    const token = getToken();
    setIsLoggedIn(!!token);

    const hasSeen = sessionStorage.getItem("hasSeenSplash");
    if (!hasSeen) {
      setShowSplash(true);
    }
  }, []);

  if (!mounted) return null;

  return (
    <>
      {showSplash && (
        <LogoSplash
          onComplete={() => {
            sessionStorage.setItem("hasSeenSplash", "true");
            setShowSplash(false);
          }}
        />
      )}
      <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden px-6">
      {/* Background Decorative Elements */}
      {/* NEW: Simple Dots Background */}
      <div className="absolute inset-0 z-0">
        <SimpleDotsBackground />
      </div>

      {/* Main Content */}
      <main className="z-10 text-center max-w-4xl mx-auto flex flex-col items-center">
        <div className="ts-fade-up">
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="h-16 w-16 rounded-3xl bg-black dark:bg-zinc-900 flex items-center justify-center p-3 shadow-2xl shadow-indigo-500/20 border border-zinc-200 dark:border-zinc-800">
              <Logo strokeWidth={24} nodeRadius={26} />
            </div>
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-b from-zinc-900 to-zinc-600 dark:from-white dark:to-zinc-400">
            ThingsString
          </h1>

          <p className="text-lg md:text-xl text-zinc-600 dark:text-zinc-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            The next generation IoT management platform. Connect, monitor, and control your devices with industrial-grade reliability and beautiful simplicity.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              href={isLoggedIn ? "/dashboard" : "/login"}
              className="relative px-8 py-4 text-lg flex items-center gap-2 group min-w-[200px] justify-center text-white rounded-xl font-semibold shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all duration-300 hover:-translate-y-1 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-violet-600 group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <span className="relative flex items-center gap-2">
                {isLoggedIn ? "Go to Dashboard" : "Get Started"}
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>
          </div>
        </div>

        {/* Features Preview - Micro-interactions */}
        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8 ts-fade-up ts-delay-2 w-full px-4">
          <div className="p-6 rounded-2xl bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm border border-zinc-200 dark:border-zinc-800 text-left hover:border-indigo-500/30 transition-all">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-4 text-indigo-600 dark:text-indigo-400">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-lg mb-2">Real-time Control</h3>
            <p className="text-sm text-zinc-500">Instant feedback and control over all your connected IoT devices with zero latency.</p>
          </div>

          <div className="p-6 rounded-2xl bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm border border-zinc-200 dark:border-zinc-800 text-left hover:border-emerald-500/30 transition-all">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4 text-emerald-600 dark:text-emerald-400">
              <Shield className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-lg mb-2">Enterprise Security</h3>
            <p className="text-sm text-zinc-500">End-to-end encryption and secure device authentication keeping your data safe.</p>
          </div>

          <div className="p-6 rounded-2xl bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm border border-zinc-200 dark:border-zinc-800 text-left hover:border-amber-500/30 transition-all">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center mb-4 text-amber-600 dark:text-amber-400">
              <Cpu className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-lg mb-2">Smart Insights</h3>
            <p className="text-sm text-zinc-500">Advanced AI-driven analytics to understand your device behavior and health.</p>
          </div>
        </div>

        {/* Floating Indicator */}
        <div className="mt-20 opacity-40">
          <LoadingSignal size="sm" />
        </div>
      </main>

      {/* Footer */}
      <footer className="absolute bottom-10 z-10 text-sm text-zinc-400 dark:text-zinc-600 flex items-center gap-6">
        <span>© 2026 ThingsString</span>
        <div className="flex gap-4">
        </div>
      </footer>
    </div>
    </>
  );
}
