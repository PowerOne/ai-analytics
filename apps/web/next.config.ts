import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  /** Monorepo root so `.next/standalone` layout is stable in Docker. */
  outputFileTracingRoot: path.join(__dirname, "../.."),
  transpilePackages: ["@learning-analytics/shared"],
};

export default nextConfig;
