import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { loadVerifiedPublicContent } from '../lib/content.mjs'

const siteRoot = path.resolve(import.meta.dirname, '..')
const readSiteFile = (file) => readFile(path.join(siteRoot, file), 'utf8')

test('all accepted pages map to explicit static documentation route entries', async () => {
  const [content, rootPage, detailPage, documentationPage] = await Promise.all([
    loadVerifiedPublicContent(),
    readSiteFile('app/docs/page.tsx'),
    readSiteFile('app/docs/[...slug]/page.tsx'),
    readSiteFile('components/docs-page.tsx')
  ])

  assert.equal(content.pages.length, 41)
  assert.match(rootPage, /DocumentationPage/)
  assert.match(detailPage, /generateStaticParams/)
  assert.match(detailPage, /dynamicParams = false/)
  assert.match(detailPage, /DocumentationPage/)
  assert.match(documentationPage, /notFound\(\)/)
  assert.match(documentationPage, /DocsNavigation/)
  assert.match(documentationPage, /DocsTableOfContents/)
  assert.match(documentationPage, /MarkdownContent/)
  assert.doesNotMatch(
    documentationPage,
    /CopyMarkdownButton|docs-article__tools|docs-source-evidence/
  )
  assert.doesNotMatch(
    `${rootPage}\n${detailPage}\n${documentationPage}`,
    /['"]use client['"]/
  )
})

test('documentation remains readable server-side with bounded enhancements', async () => {
  const [markdown, search] = await Promise.all([
    readSiteFile('components/markdown-content.tsx'),
    readSiteFile('components/search-dialog.tsx')
  ])

  assert.doesNotMatch(markdown, /['"]use client['"]|dangerouslySetInnerHTML/)
  assert.match(markdown, /parseMarkdownBlocks/)
  assert.match(markdown, /github\.com\/karote00\/asyra\/blob\/main/)
  assert.match(search, /^['"]use client['"]/)
  assert.match(search, /showModal\(\)/)
  assert.match(search, /aria-live="polite"/)
  assert.match(search, /\.focus\(\)/)
})

test('docs CSS owns three-region reading and removes auxiliary rails first', async () => {
  const css = await readSiteFile('app/styles/docs.css')

  assert.match(
    css,
    /grid-template-columns:\s*minmax\(190px, 250px\).*minmax\(0, 72ch\).*minmax\(160px, 210px\)/s
  )
  assert.match(css, /@media \(max-width: 1080px\)/)
  assert.match(css, /@media \(max-width: 767px\)/)
  assert.match(css, /overflow-x:\s*auto/)
  assert.match(css, /min-height:\s*44px/)
})
