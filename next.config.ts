import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  logging: {
    serverFunctions: false,
    incomingRequests: { ignore: [/\/auth\/confirm/] },
  },
  async headers() {
    return ["/auth/:path*", "/set-password", "/invitations"].map((source) => ({
      source,
      headers: [
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "Cache-Control", value: "private, no-store" },
        { key: "X-Robots-Tag", value: "noindex, nofollow" },
      ],
    }));
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
