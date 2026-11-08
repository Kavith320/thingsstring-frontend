"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import dynamic from "next/dynamic";
import { Mail, Lock, Eye, EyeOff, User } from "lucide-react";

import { apiRequest } from "../../lib/api";
import { setAuth } from "@/lib/auth/storage";
import GoogleButton from "@/components/auth/GoogleButton";

const SimpleDotsBackground = dynamic(() => import("@/components/common/SimpleDotsBackground"), {
  ssr: false,
});
import Logo from "@/components/common/Logo";

export default function LoginClient() {
  const router = useRouter();
  const [nextPath, setNextPath] = useState("/dashboard");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("next");
    if (p) setNextPath(p);
  }, []);

  const [mode, setMode] = useState("login"); // "login" | "register"
  const isRegister = mode === "register";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function switchMode(next) {
    setMode(next);
    setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const cleanEmail = email.trim();
    const cleanName = name.trim();
    if (!cleanEmail || !password || (isRegister && !cleanName)) {
      setError(isRegister ? "Please enter your name, email and password." : "Please enter both email and password.");
      return;
    }
    // Same limits as the backend (auth.controller.js)
    if (isRegister && (password.length < 8 || password.length > 128)) {
      setError("Password must be 8 to 128 characters.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = isRegister
        ? await apiRequest("/api/auth/register", {
            method: "POST",
            body: { name: cleanName, email: cleanEmail, password },
          })
        : await apiRequest("/api/auth/login", {
            method: "POST",
            body: { email: cleanEmail, password },
          });

      setAuth({
        token: data.token,
        userId: data.user?.id || data.user?._id,
        userId8: data.user?.userId8
      });
      router.push(nextPath);
    } catch (err) {
      setError(err.message || (isRegister ? "Registration failed" : "Login failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#050508] via-[#07070a] to-[#0b0b12]">
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />

      {/* Background */}
      <div className="absolute inset-0 -z-0">
        <SimpleDotsBackground forceTheme="dark" />
        <div className="absolute inset-0 bg-black/40" />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 py-10">
        <div className="w-full max-w-sm sm:max-w-md">
          {/* Header */}
          <div className="mb-6 sm:mb-7 text-center">
            <div className="mx-auto grid h-12 w-12 sm:h-14 sm:w-14 place-items-center rounded-2xl bg-[#17181a] border border-white/10 p-2 sm:p-2.5 shadow-lg shadow-white/5">
              <Logo strokeWidth={24} nodeRadius={26} />
            </div>
            <h1 className="mt-3 text-xl sm:text-2xl font-semibold text-white">
              ThingsString
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-gray-400">
              {isRegister ? "Create an account to manage your IoT devices" : "Sign in to manage your IoT devices"}
            </p>
          </div>

          {/* Card */}
          <form
            onSubmit={handleSubmit}
            className="rounded-3xl border border-white/15 bg-white/[0.06] p-5 sm:p-7 shadow-[0_30px_90px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
          >
            {error && (
              <div className="mb-4 rounded-2xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs sm:text-sm text-red-200">
                {error}
              </div>
            )}

            {/* Name (register only) */}
            {isRegister && (
              <div className="mb-4">
                <label className="block text-xs sm:text-sm font-medium text-gray-200">
                  Name
                </label>
                <div className="mt-2 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/35 px-4 py-2.5 focus-within:ring-2 focus-within:ring-white/10">
                  <User className="h-4 w-4 text-gray-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="Your name"
                    autoComplete="name"
                    maxLength={100}
                    className="w-full bg-transparent text-sm sm:text-base text-white placeholder:text-gray-500 outline-none"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            {/* Email */}
            <label className="block text-xs sm:text-sm font-medium text-gray-200">
              Email
            </label>
            <div className="mt-2 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/35 px-4 py-2.5 focus-within:ring-2 focus-within:ring-white/10">
              <Mail className="h-4 w-4 text-gray-400 shrink-0" />
              <input
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full bg-transparent text-sm sm:text-base text-white placeholder:text-gray-500 outline-none"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {/* Password */}
            <div className="mt-4">
              <label className="block text-xs sm:text-sm font-medium text-gray-200">
                Password
              </label>

              <div className="mt-2 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/35 px-4 py-2.5 focus-within:ring-2 focus-within:ring-white/10">
                <Lock className="h-4 w-4 text-gray-400 shrink-0" />
                <input
                  type={showPw ? "text" : "password"}
                  placeholder={isRegister ? "At least 8 characters" : "••••••••"}
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  className="w-full bg-transparent text-sm sm:text-base text-white placeholder:text-gray-500 outline-none"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="text-gray-300 hover:text-white p-1"
                  aria-label="Toggle password visibility"
                >
                  {showPw ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              disabled={loading}
              className="mt-6 w-full rounded-2xl bg-white py-2.5 sm:py-3 text-sm sm:text-base font-semibold text-black shadow-lg shadow-white/10 transition hover:bg-white/95 active:scale-[0.99] disabled:opacity-60"
            >
              {loading
                ? (isRegister ? "Creating account..." : "Signing in...")
                : (isRegister ? "Create account" : "Sign in")}
            </button>

            <p className="mt-4 text-center text-xs sm:text-sm text-gray-400">
              {isRegister ? "Already have an account?" : "New to ThingsString?"}{" "}
              <button
                type="button"
                onClick={() => switchMode(isRegister ? "login" : "register")}
                className="font-semibold text-white hover:underline"
              >
                {isRegister ? "Sign in" : "Create an account"}
              </button>
            </p>

            {/* Divider */}
            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-[10px] sm:text-xs text-gray-400">OR</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <GoogleButton onError={setError} onSuccessRedirect={nextPath} />
          </form>
        </div>
      </div>
    </div>
  );
}
