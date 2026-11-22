import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // F22: the monthly file (up to 1 MB, checked by the app with its own message) travels inside a Server Action.
    serverActions: { bodySizeLimit: "2mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
