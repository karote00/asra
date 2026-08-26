/* global URL, fetch */

import assert from 'node:assert/strict'
import process from 'node:process'
import { loadVerifiedPublicContent } from '../lib/content.mjs'

const suppliedUrl = process.env.SITE_URL
assert.ok(suppliedUrl, 'SITE_URL is required for production verification')
const baseUrl = new URL(suppliedUrl)
assert.equal(baseUrl.protocol, 'https:', 'Production SITE_URL must use HTTPS')
assert.equal(baseUrl.pathname, '/', 'Production SITE_URL must be an origin')
const origin = baseUrl.origin
const { pages } = await loadVerifiedPublicContent()

const response = await fetch(new URL('/', origin), { redirect: 'follow' })
assert.equal(response.status, 200)
assert.equal(new URL(response.url).origin, origin)
const body = await response.text()
const bodyText = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
assert.match(bodyText, /Build the tool your world needs\./)
assert.match(bodyText, /One foundation\. Any field\./)
assert.match(bodyText, /Bring your domain\. Keep its logic\./)
assert.doesNotMatch(
  bodyText,
  /2025|2026|MIT License|Open source|Asyra Systems?|Inc\.|Company/i
)

for (const header of [
  'content-security-policy',
  'permissions-policy',
  'referrer-policy',
  'strict-transport-security',
  'x-content-type-options',
  'x-frame-options'
]) {
  assert.ok(response.headers.get(header), `Missing ${header}`)
}

const robotsResponse = await fetch(new URL('/robots.txt', origin))
assert.equal(robotsResponse.status, 200)
assert.match(await robotsResponse.text(), /^Allow: \/$/m)

const sitemapResponse = await fetch(new URL('/sitemap.xml', origin))
assert.equal(sitemapResponse.status, 200)
const sitemap = await sitemapResponse.text()
const escapedOrigin = origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
assert.match(sitemap, new RegExp(`<loc>${escapedOrigin}/?</loc>`))
assert.equal((sitemap.match(/<url>/g) ?? []).length, 46)

for (const [route, copy] of [
  ['/atlas', 'Don’t take the architecture on faith. Run it.'],
  ['/docs', 'Asyra Framework'],
  ['/asyra-design', 'A complete design tool. Built with Asyra.'],
  ['/releases', 'Know exactly what your product composes.'],
  ['/roadmap', 'Build from today’s contracts. See tomorrow clearly.'],
  ...pages.map(({ href, title }) => [href, title])
]) {
  const routeResponse = await fetch(new URL(route, origin))
  assert.equal(routeResponse.status, 200, route)
  const routeText = (await routeResponse.text())
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
  assert.match(
    routeText,
    new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    route
  )
}

const llmsResponse = await fetch(new URL('/llms.txt', origin))
assert.equal(llmsResponse.status, 200)
const llms = await llmsResponse.text()
assert.match(llms, /^# Asyra Framework/m)
assert.match(llms, /Public, source-mapped documentation/)
assert.doesNotMatch(llms, /docs\/ai\//)

const missingResponse = await fetch(new URL('/launch-missing-route', origin))
assert.equal(missingResponse.status, 404)
assert.match(await missingResponse.text(), /Nothing is built here\./)

process.stdout.write(`Production smoke passed: 46 public pages at ${origin}\n`)
