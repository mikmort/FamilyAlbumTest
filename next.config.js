/** @type {import('next').NextConfig} */
const nextConfig = {
  // Only use export mode in production build
  output: process.env.NODE_ENV === 'production' ? 'export' : undefined,
  images: {
    unoptimized: true,
  },
  trailingSlash: false,
  
  // Performance optimizations for faster builds
  swcMinify: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  // Optimize bundle size
  experimental: {
    optimizePackageImports: ['react', 'react-dom'],
  },
  
  // For local development, rewrite API calls to Azure Functions port
  // However, this is disabled by default to allow Next.js API routes to work as fallbacks
  // To enable Azure Functions API, set ENABLE_API_PROXY=true in your environment
  async rewrites() {
    // Only enable API proxy if explicitly requested
    if (process.env.ENABLE_API_PROXY === 'true') {
      return [
        {
          source: '/api/:path*',
          destination: 'http://localhost:7071/api/:path*',
        },
      ];
    }
    return [];
  },
  
  // Add webpack config to handle browser-only modules
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
}

module.exports = nextConfig
