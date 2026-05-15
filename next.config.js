/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @sparticuz/chromium ships the headless Chromium binary in
  // node_modules/@sparticuz/chromium/bin. Next.js's trace doesn't follow
  // those files automatically, so the cron function needs an explicit
  // include rule or it can't find the binary at runtime.
  outputFileTracingIncludes: {
    "/api/cron/founder-slack": [
      "./node_modules/@sparticuz/chromium/bin/**/*",
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  },
};

module.exports = nextConfig;
