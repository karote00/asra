/* global URL, fetch */

import assert from 'node:assert/strict'
import process from 'node:process'
import { loadVerifiedPublicContent } from '../lib/content.mjs'

const baseUrl = process.env.SITE_URL ?? 'http://127.0.0.1:3020'

const { pages } = await loadVerifiedPublicContent()
const publicRoutes = [
  '/',
  '/atlas',
  '/asyra-design',
  '/releases',
  '/roadmap',
  ...pages.map(({ href }) => href),
  '/robots.txt',
  '/sitemap.xml',
  '/llms.txt'
]

for (const route of [...new Set(publicRoutes)]) {
  const response = await fetch(new URL(route, baseUrl))
  assert.equal(response.status, 200, route)
  const body = await response.text()
  assert.ok(body.length > 0, `${route} returned an empty surface`)
  if (route !== '/robots.txt') {
    assert.ok(body.length > 80, `${route} returned an incomplete surface`)
  }
}

const llmsResponse = await fetch(new URL('/llms.txt', baseUrl))
const llms = await llmsResponse.text()
assert.match(llms, /^# Asyra Framework/m)
assert.match(llms, /Public, source-mapped documentation/)
assert.doesNotMatch(llms, /docs\/ai\//)

const homeResponse = await fetch(new URL('/', baseUrl))
const home = await homeResponse.text()
const homeText = home.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
for (const copy of [
  'Build the tool your world needs.',
  'One foundation. Any field.',
  'Bring your domain. Keep its logic.',
  '2026',
  'MIT License'
]) {
  assert.match(
    homeText,
    new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  )
}
assert.doesNotMatch(home, /2025|Open source|Asyra Systems?|Inc\.|Company/i)

for (const [route, copy] of [
  ['/atlas', 'Don’t take the architecture on faith. Run it.'],
  ['/docs', 'Asyra Framework'],
  ['/asyra-design', 'A complete design tool. Built with Asyra.'],
  ['/releases', 'Know exactly what your product composes.'],
  ['/roadmap', 'Build from today’s contracts. See tomorrow clearly.']
]) {
  const response = await fetch(new URL(route, baseUrl))
  const text = (await response.text())
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
  assert.match(text, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
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
assert.equal((sitemap.match(/<url>/g) ?? []).length, 46)

process.stdout.write(
  'Website route smoke passed: 46 public pages and three discovery surfaces\n'
)
