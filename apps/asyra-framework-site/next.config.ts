import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { NextConfig } from 'next'

const appRoot = path.dirname(fileURLToPath(import.meta.url))

const nextConfig: NextConfig = {
  distDir: 'dist',
  poweredByHeader: false,
  reactStrictMode: true,
  typedRoutes: true,
  turbopack: {
    root: path.resolve(appRoot, '../..')
  }
}

export default nextConfig
