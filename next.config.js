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
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:7071/api/:path*',
      },
    ];
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
