import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Every signed-in page depends on the viewer's session, so navigations are
    // expected to wait on the server. Only validate segments that opt in.
    instantInsights: { validationLevel: "manual-warning" },
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
