/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  devIndicators: false,
  allowedDevOrigins: ["*.replit.dev", "*.kirk.replit.dev", "*.repl.co"],
}

export default nextConfig
