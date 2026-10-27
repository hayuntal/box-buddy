import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  // The floating dev badge sits on top of the bottom nav, which is exactly
  // where the screenshots in docs/ are taken.
  devIndicators: false,
};

export default nextConfig;
