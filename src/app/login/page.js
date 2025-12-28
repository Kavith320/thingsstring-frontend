"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../../lib/api";

export default function LoginPage() {
  const router = useRouter();

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

      localStorage.setItem("token", data.token);
      router.push("/dashboard");
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-black text-white font-bold">
            TS
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">
            ThingsString
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Sign in to manage your IoT devices
          </p>
        </div>

        <form
          onSubmit={handleLogin}
          className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6"
        >
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <label className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            type="email"
            placeholder="you@example.com"
            className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-black/10 focus:border-black"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700">
              Password
            </label>

            <div className="mt-1 flex items-center gap-2">
              <input
                type={showPw ? "text" : "password"}
                placeholder="••••••••"
                className="w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-black/10 focus:border-black"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                className="shrink-0 rounded-xl border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
              >
                {showPw ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <button
            disabled={loading}
            className="mt-6 w-full rounded-xl bg-black text-white py-2.5 font-medium hover:bg-black/90 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>

          <p className="mt-4 text-xs text-gray-500 text-center">
            By signing in you agree to the platform usage policy.
          </p>
        </form>
      </div>
    </div>
  );
}
