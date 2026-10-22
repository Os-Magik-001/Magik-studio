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
  // Pages open inside the desktop's windows (same-origin iframes); no other site may frame them.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
  // The script file readers are Node libraries; pdf.js loads parts of itself at run time.
  serverExternalPackages: ["unpdf", "mammoth", "word-extractor"],
  // Read from disk at run time: the agents' skills (@/lib/skills, shared with the edit engine)
  // and the fonts of the script PDFs (@/lib/script-pdf).
  outputFileTracingIncludes: {
    "/*": ["./engine/skills/**/SKILL.md"],
    "/scripts/*/pdf": ["./src/assets/fonts/*.ttf"],
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
