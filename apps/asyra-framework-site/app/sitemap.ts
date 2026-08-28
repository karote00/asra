import type { MetadataRoute } from 'next'
import type { VerifiedPublicContent } from '@/lib/content'
import { loadVerifiedPublicContent } from '@/lib/content.mjs'
import { resolveSiteOrigin } from '@/lib/site-origin'

const loadContent = async (): Promise<VerifiedPublicContent> =>
  loadVerifiedPublicContent()

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = resolveSiteOrigin()
  const { pages } = await loadContent()
  const routes = [
    '/',
    '/atlas',
    '/asyra-design',
    '/releases',
    '/roadmap',
    ...pages.map(({ href }) => href)
  ]

  return [...new Set(routes)].map((route) => {
    let priority = 0.7
    if (route === '/') priority = 1
    if (route === '/docs') priority = 0.9

    return {
      url: new URL(route, origin).href,
      changeFrequency: route === '/' ? 'monthly' : 'weekly',
      priority
    }
  })
}
