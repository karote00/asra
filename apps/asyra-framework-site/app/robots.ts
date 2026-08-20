import type { MetadataRoute } from 'next'
import { isIndexingAuthorized, resolveSiteOrigin } from '@/lib/site-origin'

export default function robots(): MetadataRoute.Robots {
  const origin = resolveSiteOrigin()

  return {
    rules: isIndexingAuthorized()
      ? { userAgent: '*', allow: '/' }
      : { userAgent: '*', disallow: '/' },
    sitemap: new URL('/sitemap.xml', origin).toString()
  }
}
