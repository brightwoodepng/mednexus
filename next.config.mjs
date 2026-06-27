/** @type {import('next').NextConfig} */

const replitDevDomain = process.env.REPLIT_DEV_DOMAIN ?? ""

const allowedDevOrigins = [
  "*.replit.dev",
  "*.kirk.replit.dev",
  "*.picard.replit.dev",
  "*.repl.co",
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
  turbopack: {
    root: "/home/runner/workspace",
  },
  serverExternalPackages: ["firebase-admin"],
}

export default nextConfig
