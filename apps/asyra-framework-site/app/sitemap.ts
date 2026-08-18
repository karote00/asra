import type { MetadataRoute } from 'next'
import { resolveSiteOrigin } from '@/lib/site-origin'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: resolveSiteOrigin(),
      changeFrequency: 'monthly',
      priority: 1
    }
  ]
}
