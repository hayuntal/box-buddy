import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  // The floating dev badge sits on top of the bottom nav, which is exactly
  // where the screenshots in docs/ are taken.
  devIndicators: false,
  experimental: {
    // Four downscaled fridge photos travel inside the scan Server Action;
    // the 1MB default would reject them.
    serverActions: { bodySizeLimit: "8mb" },
  },
};

export default nextConfig;
