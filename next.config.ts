import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@prisma/adapter-pg', '@prisma/client'],
  // 限制 Server Action 的 body 大小，防止大型 payload 攻擊
  experimental: {
    serverActions: {
      bodySizeLimit: '256kb',
    },
  },
};

export default nextConfig;
