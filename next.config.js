/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for Docker deployment
  output: "standalone",

  // Don't write AGENTS.md / CLAUDE.md into the repo root on every dev run
  agentRules: false,

  // Amp injects PUBLIC_URL into supervised portal services.
  allowedDevOrigins: process.env.PUBLIC_URL
    ? [new URL(process.env.PUBLIC_URL).hostname]
    : [],

  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },
};

module.exports = nextConfig;
