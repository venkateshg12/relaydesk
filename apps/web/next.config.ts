import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The shared workspace packages ship TypeScript source, so Next compiles them with the app.
  transpilePackages: ["@repo/ui", "@repo/types"],
};

export default nextConfig;
