import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { loadContentBundle, resolveContentHref } from '../lib/content.mjs'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (filePath) => fs.readFileSync(path.join(appRoot, filePath), 'utf8')
const markdownLink = /\[[^\]]+\]\(([^)]+)\)/g

test('docs route statically owns every accepted page and rejects unknown slugs', () => {
  const bundle = loadContentBundle()
  const route = read('app/docs/[[...slug]]/page.tsx')
  assert.equal(new Set(bundle.pages.map(({ slug }) => slug.join('/'))).size, 41)
  assert.match(route, /export const dynamicParams = false/)
  assert.match(route, /generateStaticParams/)
  assert.match(route, /if \(!page\) notFound\(\)/)
})

test('every internal Markdown link resolves to a page and stable heading', () => {
  const bundle = loadContentBundle()
  bundle.pages.forEach((page) => {
    for (const match of page.markdown.matchAll(markdownLink)) {
      const href = resolveContentHref({ bundle, page, href: match[1] })
      if (!href.startsWith('/docs')) continue
      const [route, fragment] = href.split('#')
      const target = bundle.pages.find((candidate) => candidate.route === route)
      assert.ok(target, `${page.id}: ${href}`)
      if (fragment) {
        assert.ok(
          target.headings.some(({ id }) => id === fragment),
          `${page.id}: ${href}`
        )
      }
    }
  })
})

test('search records target exact page or heading routes', () => {
  const bundle = loadContentBundle()
  bundle.searchRecords.forEach((record) => {
    const [route, fragment] = record.href.split('#')
    const page = bundle.pages.find((candidate) => candidate.route === route)
    assert.ok(page, record.href)
    if (fragment) {
      assert.ok(
        page.headings.some(({ id }) => id === fragment),
        record.href
      )
    }
  })
})

test('copy, mobile navigation, and search preserve browser accessibility contracts', () => {
  const copy = read('components/copy-markdown-button.tsx')
  const mobile = read('components/docs-mobile-navigation.tsx')
  const search = read('components/search-dialog.tsx')
  const chrome = read('components/docs-chrome.tsx')
  assert.match(chrome, /docs-shell-label/)
  assert.match(chrome, /READ \/ \{sectionLabel\(page\.section\)\}/)
  assert.match(copy, /navigator\.clipboard\.writeText\(markdown\)/)
  assert.match(chrome, /CopyMarkdownButton markdown=\{page\.markdown\}/)
  assert.match(mobile, /aria-modal="true"/)
  assert.match(mobile, /event\.key === 'Escape'/)
  assert.match(mobile, /event\.key !== 'Tab'/)
  assert.match(mobile, /createPortal\(/)
  assert.match(search, /aria-label="Search documentation"/)
  assert.match(search, /aria-live="polite"/)
  assert.match(search, /createPortal\(/)
  assert.match(search, /getClientRects\(\)\.length/)
})

test('Markdown rendering never injects generated HTML', () => {
  const sources = [
    'components/markdown-content.tsx',
    'components/docs-chrome.tsx',
    'components/search-dialog.tsx'
  ].map(read)
  assert.doesNotMatch(sources.join('\n'), /dangerouslySetInnerHTML/)
})
