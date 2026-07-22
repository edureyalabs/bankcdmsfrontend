// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "*.ngrok-free.dev",
    "https://fracture-distaste-spherical.ngrok-free.dev"
  ],
  serverExternalPackages: ['playwright', 'better-sqlite3'],
};

export default nextConfig;