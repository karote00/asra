import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

const siteRoot = path.resolve(import.meta.dirname, '..')
const readSiteFile = (file) => readFile(path.join(siteRoot, file), 'utf8')

test('site-wide design tokens have one canonical stylesheet owner', async () => {
  const [layout, tokens, globals, foundation, docs, support, atlas] =
    await Promise.all([
      readSiteFile('app/layout.tsx'),
      readSiteFile('app/styles/tokens.css'),
      readSiteFile('app/globals.css'),
      readSiteFile('app/styles/foundation.css'),
      readSiteFile('app/styles/docs.css'),
      readSiteFile('app/styles/support.css'),
      readSiteFile('app/styles/atlas.css')
    ])

  assert.ok(
    layout.indexOf('./styles/tokens.css') < layout.indexOf('./globals.css'),
    'tokens must load before every consumer stylesheet'
  )
  for (const token of [
    '--color-paper',
    '--paper',
    '--ink',
    '--signal-red',
    '--font-family-sans',
    '--page-max-width',
    '--frame-content',
    '--site-header-min-height',
    '--dialog-header-min-height',
    '--dialog-close-control-size'
  ]) {
    assert.match(tokens, new RegExp(`${token}:`), `Missing ${token}`)
    assert.doesNotMatch(globals, new RegExp(`${token}:`))
    assert.doesNotMatch(foundation, new RegExp(`${token}:`))
  }
  assert.doesNotMatch(`${tokens}\n${globals}\n${foundation}`, /--light:/)
  assert.doesNotMatch(
    `${globals}\n${foundation}\n${docs}\n${support}\n${atlas}`,
    /#[\da-f]{3,8}\b/i,
    'solid palette values must be declared in tokens.css'
  )
})

test('landing and supporting routes render the shared site shell components', async () => {
  const [landing, frame] = await Promise.all([
    readSiteFile('app/page.tsx'),
    readSiteFile('components/site-frame.tsx')
  ])

  assert.match(landing, /<SiteHeader variant="landing"\s*\/>/)
  assert.match(landing, /<SiteFooter\s*\/>/)
  assert.doesNotMatch(landing, /<header className="site-header"/)
  assert.doesNotMatch(landing, /<footer className="site-footer"/)
  assert.match(frame, /<SiteHeader\s*\/>/)
  assert.match(frame, /<SiteFooter\s*\/>/)
})

test('landing and supporting routes render one footer structure and narrative', async () => {
  const footer = await readSiteFile('components/site-footer.tsx')

  assert.match(footer, /<footer className="site-footer">/)
  assert.doesNotMatch(footer, /variant|site-frame-footer|supportingNavigation/)
  assert.doesNotMatch(
    footer,
    /Composable infrastructure for tools built around your domain\./
  )
  for (const destination of [
    '/docs',
    '/atlas',
    '/asyra-design',
    '/releases',
    '/roadmap',
    'https://github.com/karote00/asyra'
  ]) {
    assert.match(
      footer,
      new RegExp(`['"]${destination.replaceAll('/', '\\/')}['"]`)
    )
  }
})

test('supporting routes share an accessible product navigation shell', async () => {
  const [frame, header, footer, modalDialog, dialogCloseButton] =
    await Promise.all([
      readSiteFile('components/site-frame.tsx'),
      readSiteFile('components/site-header.tsx'),
      readSiteFile('components/site-footer.tsx'),
      readSiteFile('components/use-modal-dialog.ts'),
      readSiteFile('components/dialog-close-button.tsx')
    ])

  assert.match(frame, /Skip to content/)
  assert.match(frame, /id="main-content"/)
  for (const destination of [
    '/docs',
    '/atlas',
    '/asyra-design',
    '/releases',
    '/roadmap'
  ]) {
    assert.match(
      `${header}\n${footer}`,
      new RegExp(`['"]${destination.replaceAll('/', '\\/')}['"]`)
    )
  }
  assert.match(header, /useModalDialog\(\)/)
  assert.match(modalDialog, /showModal\(\)/)
  assert.match(header, /aria-label="Open navigation"/)
  assert.match(header, /label="Close navigation"/)
  assert.match(dialogCloseButton, /aria-label=\{label\}/)
  assert.match(header, /onClose=/)
  assert.match(modalDialog, /\.focus\(\)/)
  assert.doesNotMatch(footer, /2026|MIT License/)
  assert.match(footer, /github\.com\/karote00\/asyra/)
})

test('the supporting shell extends the accepted Landing material system', async () => {
  const [layout, tokens, css] = await Promise.all([
    readSiteFile('app/layout.tsx'),
    readSiteFile('app/styles/tokens.css'),
    readSiteFile('app/styles/foundation.css')
  ])

  assert.match(layout, /styles\/tokens\.css/)
  assert.match(layout, /styles\/foundation\.css/)
  assert.match(tokens, /--color-paper:\s*#f1eae3/i)
  assert.match(tokens, /--color-red:\s*#d51f17/i)
  assert.match(css, /engineering-grid/)
  assert.match(css, /@media \(max-width: 767px\)/)
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/)
  assert.match(css, /min-height:\s*44px/)
  assert.doesNotMatch(css, /#020b15|Cosmic Atlas/i)
})
