import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { loadVerifiedPublicContent } from '../lib/content.mjs'

const siteRoot = path.resolve(import.meta.dirname, '..')
const readSiteFile = (file) => readFile(path.join(siteRoot, file), 'utf8')

test('all accepted pages map to explicit static documentation route entries', async () => {
  const [content, rootPage, detailPage, documentationPage, technicalFlow] =
    await Promise.all([
      loadVerifiedPublicContent(),
      readSiteFile('app/docs/page.tsx'),
      readSiteFile('app/docs/[...slug]/page.tsx'),
      readSiteFile('components/docs-page.tsx'),
      readSiteFile('components/framework-technical-flow.tsx')
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
  assert.match(documentationPage, /FrameworkTechnicalFlow/)
  assert.doesNotMatch(documentationPage, /FrameworkFlowMap/)
  assert.match(documentationPage, /page\.id === 'overview'/)
  assert.match(documentationPage, /beforeHeadingId="current-support"/)
  assert.match(technicalFlow, /Two routes\. One authority\./)
  assert.match(technicalFlow, /Product intent/)
  assert.match(technicalFlow, /Existing state/)
  assert.match(technicalFlow, /Canonical owners/)
  assert.match(technicalFlow, /'Render',[\s\S]*'UI'/)
  assert.match(technicalFlow, /'Search',[\s\S]*'AI context'/)
  assert.match(technicalFlow, /'Save',[\s\S]*'Integrations'/)
  assert.match(technicalFlow, /value: 'Validate \/ Resolve'/)
  assert.doesNotMatch(technicalFlow, /framework-flow__/)
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
  const [markdown, search, modalDialog] = await Promise.all([
    readSiteFile('components/markdown-content.tsx'),
    readSiteFile('components/search-dialog.tsx'),
    readSiteFile('components/use-modal-dialog.ts')
  ])

  assert.doesNotMatch(markdown, /['"]use client['"]|dangerouslySetInnerHTML/)
  assert.match(markdown, /parseMarkdownBlocks/)
  assert.match(markdown, /beforeHeadingId/)
  assert.match(markdown, /beforeHeadingContent/)
  assert.match(markdown, /github\.com\/karote00\/asyra\/blob\/main/)
  assert.match(search, /^['"]use client['"]/)
  assert.match(search, /useModalDialog\(\)/)
  assert.match(modalDialog, /showModal\(\)/)
  assert.match(search, /aria-live="polite"/)
  assert.match(modalDialog, /\.focus\(\)/)
})

test('docs CSS owns three-region reading and a compact docs-native technical flow', async () => {
  const css = await readSiteFile('app/styles/docs.css')

  assert.match(
    css,
    /grid-template-columns:\s*minmax\(190px, 250px\).*minmax\(0, 72ch\).*minmax\(160px, 210px\)/s
  )
  assert.match(css, /@media \(max-width: 1080px\)/)
  assert.match(css, /@media \(max-width: 767px\)/)
  assert.match(css, /overflow-x:\s*auto/)
  assert.match(css, /min-height:\s*44px/)
  assert.match(
    css,
    /\.framework-technical__routes\s*\{[\s\S]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/
  )
  assert.match(
    css,
    /@media \(max-width: 680px\)[\s\S]*\.framework-technical__routes\s*\{[\s\S]*grid-template-columns:\s*1fr/
  )
})

test('public TypeScript examples name complex types before using them', async () => {
  const content = await loadVerifiedPublicContent()
  const publicDocsRoot = path.resolve(siteRoot, '../..', 'docs/public')

  for (const page of content.pages) {
    const markdown = await readFile(
      path.join(publicDocsRoot, page.path),
      'utf8'
    )
    const codeBlocks = markdown.matchAll(
      /```(?:ts|typescript)\n(?<code>[\s\S]*?)```/g
    )

    for (const match of codeBlocks) {
      const code = match.groups?.code ?? ''
      assert.doesNotMatch(
        code,
        /new Map<[^\n]*Readonly<\{/,
        `${page.path} embeds an object type inside Map`
      )
      assert.doesNotMatch(
        code,
        /new Map<[^>\n]*\([^\n)]*\)\s*=>[^>\n]*>/,
        `${page.path} embeds a function type inside Map`
      )
      assert.doesNotMatch(
        code,
        /^type \w+ = (?:Readonly<)?\{[^\n]*\}(?:>)?$/m,
        `${page.path} compresses an object type onto one line`
      )
    }
  }
})
