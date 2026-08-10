/* global URL, fetch */

import assert from 'node:assert/strict'
import process from 'node:process'
import { loadContentBundle } from '../lib/content.mjs'
import { verifiedLandingFacts } from '../lib/landing-facts.mjs'

const suppliedUrl = process.env.SITE_URL
assert.ok(
  suppliedUrl,
  'SITE_URL is required for the NEXT_PUBLIC_SITE_INDEXING=true production deployment'
)
const baseUrl = new URL(suppliedUrl)
assert.equal(baseUrl.protocol, 'https:', 'Production SITE_URL must use HTTPS')
assert.equal(baseUrl.pathname, '/', 'Production SITE_URL must be an origin')
const origin = baseUrl.origin

const bundle = loadContentBundle()
const publicRoutes = [
  '/',
  '/atlas',
  '/examples',
  '/asyra-design',
  '/releases',
  '/roadmap',
  ...bundle.pages.map(({ route }) => route)
]

const responses = new Map()
for (const route of publicRoutes) {
  const response = await fetch(new URL(route, origin), { redirect: 'follow' })
  assert.equal(response.status, 200, route)
  assert.equal(new URL(response.url).origin, origin, `${route} changed origin`)
  const body = await response.text()
  assert.ok(body.length > 80, `${route} returned an empty public surface`)
  const canonical = new URL(route, origin).toString()
  const escapedCanonical = canonical.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  assert.match(
    body,
    new RegExp(`rel="canonical"[^>]+href="${escapedCanonical}"`),
    `${route} canonical`
  )
  responses.set(route, { body, headers: response.headers })
}

const home = responses.get('/')
assert.ok(home)
for (const header of [
  'content-security-policy',
  'permissions-policy',
  'referrer-policy',
  'strict-transport-security',
  'x-content-type-options',
  'x-frame-options'
]) {
  assert.ok(home.headers.get(header), `Missing ${header}`)
}
assert.ok(home.headers.get('cache-control'), 'Missing cache-control')
assert.match(
  home.body,
  new RegExp(verifiedLandingFacts.designApp.href.replaceAll('.', '\\.'))
)

const robotsResponse = await fetch(new URL('/robots.txt', origin))
assert.equal(robotsResponse.status, 200)
const robots = await robotsResponse.text()
assert.match(robots, /^Allow: \/$/m)
assert.doesNotMatch(robots, /^Disallow: \/$/m)
assert.match(
  robots,
  new RegExp(`^Sitemap: ${origin.replaceAll('.', '\\.')}\\/sitemap\\.xml$`, 'm')
)

const sitemapResponse = await fetch(new URL('/sitemap.xml', origin))
assert.equal(sitemapResponse.status, 200)
const sitemap = await sitemapResponse.text()
for (const route of publicRoutes) {
  assert.match(
    sitemap,
    new RegExp(
      new URL(route, origin).toString().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    ),
    route
  )
}

const missingResponse = await fetch(new URL('/launch-missing-route', origin))
assert.equal(missingResponse.status, 404)
assert.match(await missingResponse.text(), /This public route does not exist/)

const designResponse = await fetch(verifiedLandingFacts.designApp.href)
assert.equal(designResponse.status, 200, 'Asyra Design public reference')
assert.match(await designResponse.text(), /<title[^>]*>Asyra Design<\/title>/i)

process.stdout.write(
  `Production smoke passed: ${publicRoutes.length + 2} anonymous public routes at ${origin}\n`
)
