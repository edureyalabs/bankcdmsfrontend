import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
  // "*.ngrok-free.app",
    "*.ngrok-free.dev",
    //"*.ngrok.io",
    "https://fracture-distaste-spherical.ngrok-free.dev"
  ],
};

export default nextConfig;