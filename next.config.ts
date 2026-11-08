import type { NextConfig } from "next";

// Optional same-origin proxy to the backend. When BACKEND_URL is set (e.g. the
// Tailscale Funnel URL), the browser calls /backend/* on this site and Vercel forwards
// it server-side. The browser then never connects to the backend directly, so there is
// no CORS, no "Local Network Access" path to a 100.x tailnet IP, and no dependence on
// the viewer's Tailscale connection. Pair it with NEXT_PUBLIC_API_URL=/backend.
const BACKEND_URL = process.env.BACKEND_URL?.replace(/\/+$/, "");

const nextConfig: NextConfig = {
  reactStrictMode: false,
  async rewrites() {
    if (!BACKEND_URL) return [];
    return [{ source: "/backend/:path*", destination: `${BACKEND_URL}/:path*` }];
  },
  turbopack: {
    root: __dirname,
  },
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "@xyflow/react",
      "@google/generative-ai",
    ],
  },
};

export default nextConfig;
