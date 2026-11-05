import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow raw body for webhook signature verification
  // (handled in the route via req.arrayBuffer())
  experimental: {},
};

export default nextConfig;

