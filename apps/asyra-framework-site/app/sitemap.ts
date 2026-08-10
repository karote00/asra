import type { MetadataRoute } from 'next'
import { loadContentBundle } from '@/lib/content'

const siteOrigin = () => {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3020'
}

export default function sitemap(): MetadataRoute.Sitemap {
  const bundle = loadContentBundle()
  const routes = [
    '/',
    '/examples',
    '/asyra-design',
    '/releases',
    '/roadmap',
    '/atlas',
    ...bundle.pages.map(({ route }) => route)
  ]
  return routes.map((route) => ({
    url: new URL(route, siteOrigin()).toString(),
    changeFrequency: route.startsWith('/docs') ? 'weekly' : 'monthly',
    priority: route === '/' ? 1 : 0.7
  }))
}
