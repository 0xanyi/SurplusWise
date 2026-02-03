/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for Docker deployment
  output: "standalone",
  
  // Transpile recharts for ESM compatibility
  transpilePackages: ["recharts", "recharts-scale", "d3-scale", "d3-shape", "d3-path", "d3-interpolate", "d3-color", "d3-format", "d3-time-format", "d3-time", "d3-array"],
  
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
