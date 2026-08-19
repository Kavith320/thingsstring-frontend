import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  turbopack: {
    root: __dirname,
  },
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "@xyflow/react",
      "@google/generative-ai",
      "animejs",
    ],
  },
};

export default nextConfig;
