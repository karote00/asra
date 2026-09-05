import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { NextConfig } from 'next'
import { resolveGoogleSiteServices } from './lib/site-google-services.mjs'

const appRoot = path.dirname(fileURLToPath(import.meta.url))
const isDevelopment = process.env.NODE_ENV === 'development'

const scriptSources = ["'self'", "'unsafe-inline'"]
const connectSources = ["'self'"]
const imageSources = ["'self'", 'data:']
if (isDevelopment) scriptSources.push("'unsafe-eval'")
if (resolveGoogleSiteServices().measurementId) {
  scriptSources.push('https://www.googletagmanager.com')
  connectSources.push(
    'https://*.google-analytics.com',
    'https://*.analytics.google.com',
    'https://www.googletagmanager.com'
  )
  imageSources.push(
    'https://*.google-analytics.com',
    'https://www.googletagmanager.com'
  )
}

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  `connect-src ${connectSources.join(' ')}`,
  "font-src 'self' data:",
  "form-action 'self'",
  "frame-ancestors 'none'",
  `img-src ${imageSources.join(' ')}`,
  "object-src 'none'",
  `script-src ${scriptSources.join(' ')}`,
  "style-src 'self' 'unsafe-inline'",
  "worker-src 'self' blob:"
].join('; ')

const nextConfig: NextConfig = {
  distDir: 'dist',
  poweredByHeader: false,
  reactStrictMode: true,
  typedRoutes: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          {
            key: 'Permissions-Policy',
            value:
              'camera=(), geolocation=(), microphone=(), payment=(), usb=()'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains'
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' }
        ]
      }
    ]
  },
  turbopack: {
    root: path.resolve(appRoot, '../..')
  }
}

export default nextConfig
