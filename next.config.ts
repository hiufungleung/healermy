import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  compiler: {
    // Remove all console.* calls ONLY in production builds
    // This won't affect 'pnpm dev' mode
    removeConsole: process.env.NODE_ENV === 'production',
  },
};

export default nextConfig;
