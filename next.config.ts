import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: false,
  // keep the demo surface clean — no floating dev-tools button
  devIndicators: false,
};

export default nextConfig;
