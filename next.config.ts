// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "*.trycloudflare.com",
    "*.ngrok-free.app"
  ],
  serverExternalPackages: ['playwright', 'better-sqlite3'],
};

export default nextConfig;