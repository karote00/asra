/* global URL, fetch */

import assert from 'node:assert/strict'
import process from 'node:process'
import { loadContentBundle } from '../lib/content.mjs'

const baseUrl = process.env.SITE_URL ?? 'http://127.0.0.1:3020'
const bundle = loadContentBundle()
const routes = [
  '/',
  '/atlas',
  '/examples',
  '/asyra-design',
  '/releases',
  '/roadmap',
  '/robots.txt',
  '/sitemap.xml',
  ...bundle.pages.map(({ route }) => route)
]

for (const route of routes) {
  const response = await fetch(new URL(route, baseUrl))
  assert.equal(response.status, 200, route)
  const body = await response.text()
  assert.ok(body.length > 0, `${route} returned an empty response`)
  if (route !== '/robots.txt') {
    assert.ok(body.length > 80, `${route} returned an empty surface`)
  }
  if (route.startsWith('/docs')) {
    const page = bundle.pages.find((candidate) => candidate.route === route)
    assert.ok(page, route)
    assert.match(
      body,
      new RegExp(page.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    )
  }
}

const missingResponse = await fetch(
  new URL('/this-route-does-not-exist', baseUrl)
)
assert.equal(missingResponse.status, 404)
assert.match(await missingResponse.text(), /This public route does not exist/)

const robotsResponse = await fetch(new URL('/robots.txt', baseUrl))
assert.match(await robotsResponse.text(), /Disallow: \/$/m)

const sitemapResponse = await fetch(new URL('/sitemap.xml', baseUrl))
const sitemap = await sitemapResponse.text()
for (const page of bundle.pages) {
  assert.match(sitemap, new RegExp(page.route.replaceAll('/', '\\/')))
}

process.stdout.write(
  `Website route smoke passed: ${routes.length} public routes\n`
)
