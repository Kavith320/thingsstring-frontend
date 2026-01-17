"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Script from "next/script";
import dynamic from "next/dynamic";

import { apiRequest } from "../../lib/api";
import { setAuth } from "@/lib/auth/storage";
import GoogleButton from "@/components/auth/GoogleButton";

const IotBackground = dynamic(() => import("@/components/auth/IotBackground"), {
  ssr: false,
});

export default function LoginClient() {
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
        <div className="absolute inset-0 [box-shadow:inset_0_0_200px_rgba(0,0,0,0.85)]" />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="mb-7 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white text-black font-bold shadow-lg shadow-white/10">
              TS
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white">
              ThingsString
            </h1>
            <p className="mt-1 text-sm text-gray-400">
              Sign in to manage your IoT devices
            </p>
          </div>

          {/* Card */}
          <form
            onSubmit={handleLogin}
            className="
              rounded-3xl
              border border-white/15
              bg-white/[0.06]
              p-7
              shadow-[0_30px_90px_rgba(0,0,0,0.6)]
              backdrop-blur-2xl
            "
          >
            {error && (
              <div className="mb-4 rounded-2xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {error}
              </div>
            )}

            {/* Email */}
            <label className="block text-sm font-medium text-gray-200">
              Email
            </label>
            <input
              type="email"
              placeholder="you@example.com"
              className="
                mt-2 w-full rounded-2xl
                border border-white/10
                bg-black/35
                px-4 py-2.5
                text-white placeholder:text-gray-500
                outline-none
                transition
                focus:border-white/20
                focus:ring-2 focus:ring-white/10
              "
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            {/* Password */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-200">
                Password
              </label>

              <div className="mt-2 flex items-center gap-2">
                <input
                  type={showPw ? "text" : "password"}
                  placeholder="••••••••"
                  className="
                    w-full rounded-2xl
                    border border-white/10
                    bg-black/35
                    px-4 py-2.5
                    text-white placeholder:text-gray-500
                    outline-none
                    transition
                    focus:border-white/20
                    focus:ring-2 focus:ring-white/10
                  "
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />

                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="
                    shrink-0 rounded-2xl
                    border border-white/10
                    bg-white/5
                    px-3 py-2.5
                    text-xs text-gray-200
                    hover:bg-white/10
                    transition
                  "
                >
                  {showPw ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              disabled={loading}
              className="
                mt-6 w-full rounded-2xl
                bg-white py-2.5
                font-semibold text-black
                shadow-lg shadow-white/10
                transition
                hover:bg-white/95
                active:scale-[0.99]
                disabled:opacity-60 disabled:cursor-not-allowed
              "
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>

            {/* Divider */}
            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-xs text-gray-400">OR</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <GoogleButton onError={setError} onSuccessRedirect={next} />

            <p className="mt-5 text-center text-xs text-gray-400">
              By signing in you agree to the platform usage policy.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
