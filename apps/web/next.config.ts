import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        // :path* strips trailing slash, so we add it back for Django
        source: "/api/:path*",
        destination: `${API_URL}/api/:path*/`,
      },
    ];
  },
  skipTrailingSlashRedirect: true,
  allowedDevOrigins: ["127.0.0.1", "192.168.137.149"],
};

// Only wrap with Sentry if DSN is provided
const exported = process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, {
      silent: true,
      disableLogger: true,
    })
  : nextConfig;

export default exported;
