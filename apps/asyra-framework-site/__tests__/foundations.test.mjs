import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { loadContentBundle } from '../lib/content.mjs'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (filePath) => fs.readFileSync(path.join(appRoot, filePath), 'utf8')

test('not-found and content-failure states never fabricate fallback output', () => {
  const notFound = read('app/not-found.tsx')
  const error = read('app/error.tsx')
  const loading = read('app/loading.tsx')
  assert.match(notFound, /No fallback page or guessed documentation/i)
  assert.match(
    error,
    /No fallback copy, release fact, or product output was fabricated/i
  )
  assert.match(error, /Retry this route/)
  assert.match(loading, /No placeholder product output is\s+shown/i)
  assert.match(loading, /aria-live="polite"/)
})

test('unsupported-browser state is global, explicit, and content-safe', () => {
  const layout = read('app/layout.tsx')
  const state = read('components/foundation-browser-support.tsx')
  const styles = read('app/globals.css')
  assert.match(layout, /FoundationBrowserSupport/)
  assert.match(state, /cannot present the Asyra working sheet/i)
  assert.match(state, /has not substituted simplified or fabricated content/i)
  assert.match(styles, /@supports not \(display: grid\)/)
})

test('robots stay closed until production indexing is explicitly authorized', () => {
  const source = read('app/robots.ts')
  assert.match(source, /VERCEL_ENV === 'production'/)
  assert.match(source, /NEXT_PUBLIC_SITE_INDEXING === 'true'/)
  assert.match(source, /disallow: '\/'/)
})

test('sitemap derives all content routes and uses only observed deployment hosts', () => {
  const bundle = loadContentBundle()
  const source = read('app/sitemap.ts')
  assert.equal(bundle.pages.length, 41)
  assert.match(source, /\.\.\.bundle\.pages\.map/)
  assert.match(source, /process\.env\.VERCEL_URL/)
  assert.match(source, /http:\/\/localhost:3020/)
  assert.doesNotMatch(source, /https:\/\/asyra\./)
})

test('Landing and Atlas remain downstream placeholders', () => {
  assert.match(
    read('app/page.tsx'),
    /owned by the next\s+Landing implementation stage/i
  )
  assert.match(
    read('app/atlas/page.tsx'),
    /belong to the dedicated\s+Atlas\s+implementation stage/i
  )
})
