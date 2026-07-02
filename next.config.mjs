/** @type {import('next').NextConfig} */

const replitDevDomain = process.env.REPLIT_DEV_DOMAIN ?? ""

const allowedDevOrigins = [
  "*.replit.dev",
  "*.kirk.replit.dev",
  "*.picard.replit.dev",
  "*.repl.co",
  "127.0.0.1",
]
if (replitDevDomain) allowedDevOrigins.push(replitDevDomain)

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  devIndicators: false,
  allowedDevOrigins,
  serverExternalPackages: ["firebase-admin"],
}

export default nextConfig
