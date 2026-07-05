import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  async redirects() {
    return [
      {
        source: '/b/:businessId',
        destination: '/q/:businessId',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
