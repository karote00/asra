import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const indexingAuthorized =
    process.env.VERCEL_ENV === 'production' &&
    process.env.NEXT_PUBLIC_SITE_INDEXING === 'true'

  return {
    rules: indexingAuthorized
      ? { userAgent: '*', allow: '/' }
      : { userAgent: '*', disallow: '/' }
  }
}
