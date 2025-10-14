/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  // Remove app/api routes from build (now using Azure Functions)
  // API routes will be handled by Azure Functions in /api folder
}

module.exports = nextConfig
