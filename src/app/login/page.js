"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Script from "next/script";
import dynamic from "next/dynamic";
import { Mail, Lock, Eye, EyeOff, ShieldCheck } from "lucide-react";

import { apiRequest } from "../../lib/api";
import { setAuth } from "@/lib/auth/storage";
import GoogleButton from "@/components/auth/GoogleButton";

const IotBackground = dynamic(() => import("@/components/auth/IotBackground"), {
  ssr: false,
});

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const data = await apiRequest("/api/auth/login", {
        method: "POST",
        body: { email, password },
      });

      setAuth({ token: data.token, userId8: data.user?.userId8 });
      router.push(next);
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#050508] via-[#07070a] to-[#0b0b12]">
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />

      <div className="absolute inset-0 -z-0">
        <IotBackground />
        <div className="absolute inset-0 bg-black/40" />
        {/* subtle vignette */}
        <div className="absolute inset-0 [box-shadow:inset_0_0_220px_rgba(0,0,0,0.85)]" />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="mb-8 text-center">
            <div className="mx-auto w-fit rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <div className="relative grid h-12 w-12 place-items-center rounded-xl bg-white text-black font-bold">
                  TS
                  <div className="pointer-events-none absolute inset-0 rounded-xl bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.65),transparent_55%)] opacity-70" />
                </div>
                <div className="text-left">
                  <p className="text-sm text-gray-300">Welcome back</p>
                  <h1 className="text-lg font-semibold tracking-tight text-white">
                    ThingsString
                  </h1>
                </div>
              </div>
            </div>

            <p className="mt-3 text-sm text-gray-400">
              Sign in to monitor devices, alerts, and automation.
            </p>
          </div>

          {/* Card */}
          <div className="relative rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur-2xl">
            {/* shine */}
            <div className="pointer-events-none absolute inset-0 rounded-3xl bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.10),transparent_45%)]" />
            <div className="pointer-events-none absolute inset-0 rounded-3xl bg-[linear-gradient(to_bottom,rgba(255,255,255,0.06),transparent_35%,rgba(0,0,0,0.10))]" />

            {/* top badge */}
            <div className="mb-5 flex items-center justify-between">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-gray-300">
                <ShieldCheck className="h-4 w-4" />
                Secure sign-in
              </div>

              <span className="text-xs text-gray-500">v1</span>
            </div>

            {error && (
              <div className="mb-4 rounded-2xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-200">
                  Email
                </label>
                <div className="mt-1 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-3 py-2 focus-within:ring-2 focus-within:ring-white/15">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <input
                    type="email"
                    placeholder="you@example.com"
                    className="w-full bg-transparent text-white placeholder:text-gray-500 outline-none"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-200">
                  Password
                </label>
                <div className="mt-1 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-3 py-2 focus-within:ring-2 focus-within:ring-white/15">
                  <Lock className="h-4 w-4 text-gray-400" />
                  <input
                    type={showPw ? "text" : "password"}
                    placeholder="••••••••"
                    className="w-full bg-transparent text-white placeholder:text-gray-500 outline-none"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((s) => !s)}
                    className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-2.5 py-2 text-gray-200 hover:bg-white/10"
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-gray-500">Use 8+ characters</span>
                  <button
                    type="button"
                    className="text-xs text-gray-300 hover:text-white underline underline-offset-4 decoration-white/20"
                    onClick={() => setError("If you need reset flow, tell me your backend route for it.")}
                  >
                    Forgot password?
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                disabled={loading}
                className="group relative mt-2 w-full overflow-hidden rounded-2xl bg-white py-2.5 font-semibold text-black shadow-lg shadow-white/10 hover:bg-white/95 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span className="relative z-10">
                  {loading ? "Signing in..." : "Sign in"}
                </span>
                <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.9),transparent_55%)]" />
              </button>

              {/* Divider */}
              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-[11px] tracking-wider text-gray-400">OR CONTINUE WITH</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              <GoogleButton onError={setError} onSuccessRedirect={next} />

              <p className="pt-2 text-center text-xs text-gray-400">
                By signing in, you agree to the platform usage policy.
              </p>
            </form>
          </div>

          {/* tiny footer */}
          <p className="mt-6 text-center text-xs text-gray-500">
            © {new Date().getFullYear()} ThingsString • IoT Monitoring Platform
          </p>
        </div>
      </div>
    </div>
  );
}
