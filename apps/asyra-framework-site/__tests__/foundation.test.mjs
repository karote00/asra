import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

const siteRoot = path.resolve(import.meta.dirname, '..')
const readSiteFile = (file) => readFile(path.join(siteRoot, file), 'utf8')

test('supporting routes share an accessible product navigation shell', async () => {
  const [frame, header, footer] = await Promise.all([
    readSiteFile('components/site-frame.tsx'),
    readSiteFile('components/site-header.tsx'),
    readSiteFile('components/site-footer.tsx')
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
  assert.match(header, /showModal\(\)/)
  assert.match(header, /aria-label="Open navigation"/)
  assert.match(header, /aria-label="Close navigation"/)
  assert.match(header, /onClose=/)
  assert.match(header, /\.focus\(\)/)
  assert.match(footer, /2026/)
  assert.match(footer, /MIT License/)
  assert.match(footer, /github\.com\/karote00\/asyra/)
})

test('the supporting shell extends the accepted Landing material system', async () => {
  const [layout, css] = await Promise.all([
    readSiteFile('app/layout.tsx'),
    readSiteFile('app/styles/foundation.css')
  ])

  assert.match(layout, /styles\/foundation\.css/)
  assert.match(css, /--paper:\s*#f1eae3/i)
  assert.match(css, /--signal-red:\s*#d51f17/i)
  assert.match(css, /engineering-grid/)
  assert.match(css, /@media \(max-width: 767px\)/)
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/)
  assert.match(css, /min-height:\s*44px/)
  assert.doesNotMatch(css, /#020b15|Cosmic Atlas/i)
})
