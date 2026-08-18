/* global URL, fetch */

import assert from 'node:assert/strict'
import process from 'node:process'

const baseUrl = process.env.SITE_URL ?? 'http://127.0.0.1:3020'

for (const route of ['/', '/robots.txt', '/sitemap.xml']) {
  const response = await fetch(new URL(route, baseUrl))
  assert.equal(response.status, 200, route)
  const body = await response.text()
  assert.ok(body.length > 0, `${route} returned an empty surface`)
  if (route !== '/robots.txt') {
    assert.ok(body.length > 80, `${route} returned an incomplete surface`)
  }
}

const homeResponse = await fetch(new URL('/', baseUrl))
const home = await homeResponse.text()
const homeText = home.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
for (const copy of [
  'Build the tool your world needs.',
  'One foundation. Any field.',
  'Bring your domain. Keep its logic.',
  '2026',
  'Open source',
  'MIT License'
]) {
  assert.match(
    homeText,
    new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  )
}
assert.doesNotMatch(home, /2025|Asyra Systems?|Inc\.|Company/i)

for (const removedRoute of [
  '/atlas',
  '/docs',
  '/roadmap',
  '/releases',
  '/asyra-design'
]) {
  const response = await fetch(new URL(removedRoute, baseUrl))
  assert.equal(response.status, 404, `${removedRoute} must remain removed`)
}

const missingResponse = await fetch(
  new URL('/this-route-does-not-exist', baseUrl)
)
assert.equal(missingResponse.status, 404)
assert.match(await missingResponse.text(), /Nothing is built here\./)

const robotsResponse = await fetch(new URL('/robots.txt', baseUrl))
assert.match(await robotsResponse.text(), /(?:Allow|Disallow): \/$/m)

const sitemapResponse = await fetch(new URL('/sitemap.xml', baseUrl))
const sitemap = await sitemapResponse.text()
assert.equal((sitemap.match(/<url>/g) ?? []).length, 1)

process.stdout.write(
  'Website route smoke passed: one landing route and two metadata surfaces\n'
)
