import type { NextConfig } from "next";
const nextConfig: any = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  serverActions: { bodySizeLimit: "10mb" },
  experimental: {
    agentFeedback: true,
    cacheComponents: true,
    partialPrefetching: true,
  },
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
};
export default nextConfig;
