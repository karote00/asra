import type { MetadataRoute } from 'next'
import { loadContentBundle } from '@/lib/content'
import { resolveSiteOrigin } from '@/lib/site-origin'

export default function sitemap(): MetadataRoute.Sitemap {
  const bundle = loadContentBundle()
  const origin = resolveSiteOrigin()
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
    url: new URL(route, origin).toString(),
    changeFrequency: route.startsWith('/docs') ? 'weekly' : 'monthly',
    priority: route === '/' ? 1 : 0.7
  }))
}
