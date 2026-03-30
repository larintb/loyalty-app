import type { NextConfig } from "next";

const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
  serverExternalPackages: [],
} satisfies NextConfig;

export default nextConfig;
