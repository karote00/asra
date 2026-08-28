import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

const siteRoot = path.resolve(import.meta.dirname, '..')
const readSiteFile = (file) => readFile(path.join(siteRoot, file), 'utf8')

test('Atlas route explains the current browser boundary before runtime depth', async () => {
  const page = await readSiteFile('app/atlas/page.tsx')

  assert.match(page, /Runtime Atlas/)
  assert.match(page, /real public runtime/i)
  assert.match(page, /browser\/Core composition/i)
  assert.match(page, /not a Headless Core/i)
  assert.match(page, /\/roadmap/)
  assert.match(page, /RuntimeAtlas/)
})

test('presentation creates and terminates workers instead of synthesizing results', async () => {
  const component = await readSiteFile('components/runtime-atlas.tsx')

  assert.match(component, /new Worker\(/)
  assert.match(component, /runtime-atlas\.worker\.ts/)
  assert.match(component, /\.terminate\(\)/)
  assert.match(component, /Run remaining/)
  assert.match(component, /Pause/)
  assert.match(component, />\s*Step\s*</)
  assert.match(component, /Replay/)
  assert.match(component, /Reset/)
  assert.match(component, /aria-live="polite"/)
  assert.match(component, /prefers-reduced-motion/)
  assert.doesNotMatch(component, /canonicalValue:\s*5|actorB:\s*7/)
})

test('Atlas presents advanced guides with public titles instead of internal ids', async () => {
  const component = await readSiteFile('components/runtime-atlas.tsx')
  const guides = [
    ['learn/information-models', 'Information models come before output'],
    ['build/custom-schema', 'Build a custom component and schema'],
    ['build/feature-session', 'Build a transaction-safe Feature session'],
    ['build/collaboration', 'Build opt-in collaboration'],
    ['build/ai-actions', 'Build registered AI actions'],
    ['build/app-retrieval-action', 'Build app-owned AI retrieval and action']
  ]

  for (const [guideId, title] of guides) {
    assert.match(component, new RegExp(`['"]${guideId}['"]`))
    assert.match(component, new RegExp(`['"]${title}['"]`))
  }

  assert.match(component, /href=\{`\/docs\/\$\{guideId\}`\}/)
  assert.doesNotMatch(component, />\s*\{guideId\}\s*</)
  assert.doesNotMatch(component, /\?\?\s*guideId/)
})

test('Atlas styling preserves material hierarchy and responsive controls', async () => {
  const css = await readSiteFile('app/styles/atlas.css')

  assert.match(css, /atlas-shell/)
  assert.match(css, /atlas-case-picker/)
  assert.match(css, /atlas-route-map/)
  assert.match(css, /atlas-evidence/)
  assert.match(css, /atlas-projection/)
  assert.match(css, /@media \(max-width: 900px\)/)
  assert.match(css, /@media \(max-width: 600px\)/)
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/)
  assert.doesNotMatch(css, /Cosmic Atlas|#020b15/i)
})

test('Atlas wide layout uses aligned editorial bookends around the focused studio', async () => {
  const css = await readSiteFile('app/styles/atlas.css')

  assert.match(
    css,
    /\.atlas-boundary\s*{[^}]*max-width:\s*var\(--page-max-width\)/s
  )
  assert.match(
    css,
    /\.atlas-shell\s*{[^}]*max-width:\s*var\(--frame-content\)/s
  )
})
