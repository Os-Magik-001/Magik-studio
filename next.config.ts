import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Every signed-in page depends on the viewer's session, so navigations are
    // expected to wait on the server. Only validate segments that opt in.
    instantInsights: { validationLevel: "manual-warning" },
    // Script files (PDF, Word, text) up to 4 MB go to a server action to be read; Vercel takes
    // request bodies up to 4.5 MB.
    serverActions: { bodySizeLimit: "4.5mb" },
  },
  // The script file readers are Node libraries; pdf.js loads parts of itself at run time.
  serverExternalPackages: ["unpdf", "mammoth", "word-extractor"],
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
