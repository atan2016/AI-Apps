/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configure for subdirectory deployment
  basePath: '/imageEnhancer',
  assetPrefix: '/imageEnhancer',
  
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
  
  // Output configuration
  output: 'standalone',
};

module.exports = nextConfig;

