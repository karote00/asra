import type { MetadataRoute } from 'next'
import { isIndexingAuthorized, resolveSiteOrigin } from '@/lib/site-origin'

export default function robots(): MetadataRoute.Robots {
  const indexingAuthorized = isIndexingAuthorized()
  const origin = resolveSiteOrigin()

  return {
    rules: indexingAuthorized
      ? { userAgent: '*', allow: '/' }
      : { userAgent: '*', disallow: '/' },
    sitemap: new URL('/sitemap.xml', origin).toString()
  }
}
