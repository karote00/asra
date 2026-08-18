type SiteEnvironment = Readonly<Record<string, string | undefined>>

const normalizeOrigin = (value: string, allowLocalHttp = false) => {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('Site URL must be a valid HTTPS origin')
  }

  const localHttp =
    allowLocalHttp &&
    url.protocol === 'http:' &&
    (url.hostname === '127.0.0.1' || url.hostname === 'localhost')
  if (
    (!localHttp && url.protocol !== 'https:') ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error('Site URL must be a valid HTTPS origin')
  }

  return url.origin
}

const vercelOrigin = (hostname: string) =>
  normalizeOrigin(`https://${hostname}`)

export const resolveSiteOrigin = (
  environment: SiteEnvironment = process.env
) => {
  if (environment.NEXT_PUBLIC_SITE_URL) {
    return normalizeOrigin(environment.NEXT_PUBLIC_SITE_URL)
  }
  if (environment.VERCEL_PROJECT_PRODUCTION_URL) {
    return vercelOrigin(environment.VERCEL_PROJECT_PRODUCTION_URL)
  }
  if (environment.VERCEL_URL) {
    return vercelOrigin(environment.VERCEL_URL)
  }
  return normalizeOrigin('https://asyra-framework.vercel.app')
}

export const isIndexingAuthorized = (
  environment: SiteEnvironment = process.env
) =>
  environment.VERCEL_ENV === 'production' &&
  environment.NEXT_PUBLIC_SITE_INDEXING === 'true'
