import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Playwright/playwright-core no pueden bundlearse en Vercel serverless.
  // Se declaran como externos para que Node los resuelva en runtime (solo localmente)
  // y no crasheen el instrumentation hook en producción.
  serverExternalPackages: ["playwright", "playwright-core"],
};

export default nextConfig;
