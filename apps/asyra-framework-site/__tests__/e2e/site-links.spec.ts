import { expect, test } from '@playwright/test'
import { access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const escapePattern = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../..'
)
const githubBlobPrefix = '/karote00/asyra/blob/main/'

test('every public page and server-rendered internal link resolves', async ({
  request
}) => {
  const sitemapResponse = await request.get('/sitemap.xml')
  expect(sitemapResponse.status()).toBe(200)
  const sitemap = await sitemapResponse.text()
  const routes = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    ([, location]) => new URL(location).pathname
  )

  expect(routes).toHaveLength(46)

  const routeResponses = await Promise.all(
    routes.map(async (route) => {
      const response = await request.get(route)
      expect(response.status(), route).toBe(200)
      return [route, await response.text(), response.url()] as const
    })
  )
  const routeBodies = new Map(
    routeResponses.map(([route, body]) => [route, body] as const)
  )
  const siteOrigin = new URL(routeResponses[0]?.[2] ?? sitemapResponse.url())
    .origin
  const externalOrigins = new Set<string>()
  const externalUrls = new Set<string>()

  for (const [source, body] of routeBodies) {
    const anchors = [...body.matchAll(/<a\b[^>]*>/g)].map(([anchor]) => anchor)

    for (const anchor of anchors) {
      const rawHref = anchor.match(/\bhref="([^"]+)"/)?.[1]
      if (!rawHref) continue

      const href = rawHref.replaceAll('&amp;', '&')
      const destination = new URL(href, new URL(source, siteOrigin))
      if (destination.origin !== siteOrigin) {
        externalOrigins.add(destination.origin)
        externalUrls.add(destination.href)
        expect(anchor, `${source} -> ${destination.href}`).toMatch(
          /\btarget="_blank"/
        )
        expect(anchor, `${source} -> ${destination.href}`).toMatch(
          /\brel="noopener noreferrer"/
        )

        if (
          destination.hostname === 'github.com' &&
          destination.pathname.startsWith(githubBlobPrefix)
        ) {
          const sourcePath = decodeURIComponent(
            destination.pathname.slice(githubBlobPrefix.length)
          )
          const localPath = path.resolve(repositoryRoot, sourcePath)
          expect(localPath.startsWith(`${repositoryRoot}${path.sep}`)).toBe(
            true
          )
          await expect(
            access(localPath),
            `${source} -> ${destination.href}`
          ).resolves.toBeUndefined()
        }
        continue
      }

      const destinationRoute = destination.pathname
      let destinationBody = routeBodies.get(destinationRoute)
      if (!destinationBody) {
        const response = await request.get(
          `${destinationRoute}${destination.search}`
        )
        expect(
          response.status(),
          `${source} -> ${destination.pathname}${destination.search}`
        ).toBe(200)
        destinationBody = await response.text()
        routeBodies.set(destinationRoute, destinationBody)
      }

      if (!destination.hash) continue

      const id = decodeURIComponent(destination.hash.slice(1))
      expect(
        destinationBody,
        `${source} -> ${destination.pathname}${destination.hash}`
      ).toMatch(new RegExp(`\\bid="${escapePattern(id)}"`))
    }
  }

  expect(externalOrigins).toEqual(
    new Set(['https://asyra-design.vercel.app', 'https://github.com'])
  )
  expect(externalUrls).toContain('https://asyra-design.vercel.app/?fileId=demo')
})
