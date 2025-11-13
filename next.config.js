/** @type {import('next').NextConfig} */

// Only use basePath in production (when deployed to subdirectory)
const isProduction = process.env.NODE_ENV === 'production';
const useSubdirectory = process.env.USE_SUBDIRECTORY === 'true';

const nextConfig = {
  // Configure for subdirectory deployment only in production
  ...(isProduction && useSubdirectory ? {
    basePath: '/imageEnhancer',
    assetPrefix: '/imageEnhancer',
  } : {}),
  
  // Ensure trailing slashes are handled correctly
  trailingSlash: false,
  
  // Image optimization configuration
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'replicate.delivery',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'ddnzufqxxlzvakzkgdwe.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
    dangerouslyAllowSVG: true,
    unoptimized: true, // For self-hosted deployment
  },
  
  // Output configuration (only for production builds)
  ...(isProduction ? { output: 'standalone' } : {}),
};

module.exports = nextConfig;

