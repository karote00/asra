import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { isIndexingAuthorized, resolveSiteOrigin } from '../lib/site-origin.ts'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (filePath) => fs.readFileSync(path.join(appRoot, filePath), 'utf8')

test('stable site origin is explicit, production-safe, and never guessed from a branch URL first', () => {
  assert.equal(resolveSiteOrigin({}), 'http://127.0.0.1:3020')
  assert.equal(
    resolveSiteOrigin({
      VERCEL_PROJECT_PRODUCTION_URL: 'framework-site.example.test',
      VERCEL_URL: 'preview-site.example.test'
    }),
    'https://framework-site.example.test'
  )
  assert.equal(
    resolveSiteOrigin({
      NEXT_PUBLIC_SITE_URL: 'https://docs.example.test/',
      VERCEL_PROJECT_PRODUCTION_URL: 'framework-site.example.test'
    }),
    'https://docs.example.test'
  )
  assert.throws(
    () => resolveSiteOrigin({ NEXT_PUBLIC_SITE_URL: 'javascript:alert(1)' }),
    /valid HTTPS origin/i
  )
  assert.throws(
    () =>
      resolveSiteOrigin({
        NEXT_PUBLIC_SITE_URL: 'https://docs.example.test/guide'
      }),
    /valid HTTPS origin/i
  )
})

test('indexing opens only for an explicitly authorized production deployment', () => {
  assert.equal(isIndexingAuthorized({}), false)
  assert.equal(
    isIndexingAuthorized({
      VERCEL_ENV: 'preview',
      NEXT_PUBLIC_SITE_INDEXING: 'true'
    }),
    false
  )
  assert.equal(
    isIndexingAuthorized({
      VERCEL_ENV: 'production',
      NEXT_PUBLIC_SITE_INDEXING: 'false'
    }),
    false
  )
  assert.equal(
    isIndexingAuthorized({
      VERCEL_ENV: 'production',
      NEXT_PUBLIC_SITE_INDEXING: 'true'
    }),
    true
  )
})

test('metadata, robots, and sitemap share the stable origin and indexing owner', () => {
  const layout = read('app/layout.tsx')
  const robots = read('app/robots.ts')
  const sitemap = read('app/sitemap.ts')
  assert.match(layout, /metadataBase: new URL\(resolveSiteOrigin\(\)\)/)
  assert.match(layout, /alternates:[\s\S]*canonical: '\/'/)
  assert.match(layout, /robots: isIndexingAuthorized\(\)/)
  assert.match(robots, /isIndexingAuthorized\(\)/)
  assert.match(robots, /sitemap: new URL\('\/sitemap\.xml', origin\)/)
  assert.match(sitemap, /const origin = resolveSiteOrigin\(\)/)
  assert.doesNotMatch(sitemap, /VERCEL_URL/)
})

test('every indexable route owns its exact canonical path', () => {
  ;[
    ['app/asyra-design/page.tsx', '/asyra-design'],
    ['app/atlas/page.tsx', '/atlas'],
    ['app/examples/page.tsx', '/examples'],
    ['app/releases/page.tsx', '/releases'],
    ['app/roadmap/page.tsx', '/roadmap']
  ].forEach(([filePath, route]) => {
    assert.match(
      read(filePath),
      new RegExp(`alternates: \\{ canonical: '${route}' \\}`),
      filePath
    )
  })
  assert.match(
    read('app/docs/[[...slug]]/page.tsx'),
    /alternates: \{ canonical: page\.route \}/
  )
})

test('Framework site Vercel configuration builds only the site workspace from the monorepo', () => {
  const config = JSON.parse(read('vercel.json'))
  assert.equal(config.framework, 'nextjs')
  assert.equal(
    config.installCommand,
    'cd ../.. && corepack enable && corepack prepare yarn@4.3.1 --activate && yarn install --immutable'
  )
  assert.equal(config.buildCommand, 'yarn react:build')
  assert.equal(config.outputDirectory, undefined)
  assert.equal(config.git?.deploymentEnabled?.['*'], false)
})

test('all document responses receive the reviewed launch security headers', () => {
  const config = read('next.config.ts')
  ;[
    'Content-Security-Policy',
    'Permissions-Policy',
    'Referrer-Policy',
    'Strict-Transport-Security',
    'X-Content-Type-Options',
    'X-Frame-Options'
  ].forEach((header) => assert.match(config, new RegExp(header)))
  assert.match(config, /source: '\/\(\.\*\)'/)
})

test('Asyra Design case study uses the same verified public fact as Landing', () => {
  const page = read('app/asyra-design/page.tsx')
  assert.match(page, /verifiedLandingFacts\.designApp\.href/)
  assert.match(page, /Open \{verifiedLandingFacts\.designApp\.title\}/)
  assert.match(page, /Verified \{verifiedLandingFacts\.designApp\.verifiedAt\}/)
  assert.doesNotMatch(page, /No public Asyra Design deployment URL/i)
})

test('production smoke and browser gates are URL-driven and tracked before Preview acceptance', () => {
  const smoke = read('scripts/production-smoke.mjs')
  const browser = read('__tests__/e2e/launch-production.spec.ts')
  assert.match(smoke, /process\.env\.SITE_URL/)
  assert.match(smoke, /NEXT_PUBLIC_SITE_INDEXING=true production deployment/i)
  assert.match(smoke, /content-security-policy/i)
  assert.match(smoke, /verifiedLandingFacts\.designApp\.href/)
  assert.match(browser, /process\.env\.SITE_URL/)
  assert.match(browser, /Search documentation/)
  assert.match(browser, /data-atlas-status/)
  assert.match(browser, /scrollWidth/)
})
