import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The desktop review browser opens the local server by IP. Next 16 blocks
  // development chunks from alternate origins unless they are explicit.
  allowedDevOrigins: ['127.0.0.1'],
  images: {
    remotePatterns: [
      // Supabase storage
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      // Company logos
      {
        protocol: 'https',
        hostname: 'logo.clearbit.com',
      },
      {
        protocol: 'https',
        hostname: 'media.licdn.com',
      },
      // Job board images
      {
        protocol: 'https',
        hostname: 'remotive.com',
      },
      {
        protocol: 'https',
        hostname: '*.themuse.com',
      },
      {
        protocol: 'https',
        hostname: 'arbeitnow.com',
      },
      // Common CDNs for company logos
      {
        protocol: 'https',
        hostname: 'cdn.jsdelivr.net',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
    ],
  },
  serverExternalPackages: [
    '@adobe/pdfservices-node-sdk',
    'log4js',
  ],
  // Security headers
  async headers() {
    return [
      {
        // Apply to all routes
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ]
  },
}

const configureNext = (phase) => ({
  ...nextConfig,
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next',
})

export default configureNext
