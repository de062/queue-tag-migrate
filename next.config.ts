import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
