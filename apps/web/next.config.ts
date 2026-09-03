import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@signalstack/schemas"],
};

export default nextConfig;
