import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

const siteRoot = path.resolve(import.meta.dirname, '..')
const readSiteFile = (file) => readFile(path.join(siteRoot, file), 'utf8')

test('Asyra Design is presented as the official product and an App-owned reference', async () => {
  const page = await readSiteFile('app/asyra-design/page.tsx')

  assert.match(page, /official design tool app/i)
  assert.match(page, /reference implementation/i)
  assert.match(page, /not the\s+Framework owner/i)
  assert.match(
    page,
    /https:\/\/asyra-karote00s-projects\.vercel\.app\/\?fileId=demo/
  )
  assert.equal((page.match(/fileId=demo/g) ?? []).length, 1)
  assert.match(page, /\/docs\/start\/create-design-app/)
  assert.match(page, /cases\/asyra-design/)
})

test('release inventory is generated from package facts without duplicated versions', async () => {
  const page = await readSiteFile('app/releases/page.tsx')

  assert.match(page, /loadVerifiedPublicContent/)
  assert.match(page, /content\.packages/)
  assert.match(page, /19 public packages/)
  assert.match(page, /Manifest-derived inventory/)
  assert.doesNotMatch(page, /['"]\d+\.\d+\.\d+['"]|version:\s*['"]/)
  assert.match(page, /reference\/support-release/)
})

test('roadmap separates current support from researched future runtime', async () => {
  const page = await readSiteFile('app/roadmap/page.tsx')

  assert.match(page, /What is current/)
  assert.match(page, /What is future/)
  assert.match(page, /Do not claim yet/)
  assert.match(page, /not\s+a current API/i)
  assert.match(page, /learn\/runtime-boundaries-roadmap/)
})

test('supporting routes retain the material system across responsive widths', async () => {
  const css = await readSiteFile('app/styles/support.css')

  assert.match(css, /support-hero/)
  assert.match(css, /ownership-map/)
  assert.match(css, /package-ledger/)
  assert.match(css, /@media \(max-width: 900px\)/)
  assert.match(css, /@media \(max-width: 600px\)/)
  assert.doesNotMatch(css, /#020b15|Cosmic Atlas/i)
})
