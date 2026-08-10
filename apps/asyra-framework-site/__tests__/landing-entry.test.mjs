import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { URL, fileURLToPath } from 'node:url'
import { verifiedLandingFacts } from '../lib/landing-facts.mjs'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (filePath) => fs.readFileSync(path.join(appRoot, filePath), 'utf8')
const compact = (value) => value.replace(/\s+/g, ' ')

test('Asyra Design uses the exact dated anonymously verified public fact', () => {
  assert.deepEqual(verifiedLandingFacts.designApp, {
    href: 'https://asra.vercel.app/?fileId=asyra-framework-demo',
    title: 'Asyra Design',
    verifiedAt: '2026-08-11',
    evidence:
      'The stable alias returned an anonymous HTTP 200 document titled Asyra Design with the demo fileId in the requested URL.'
  })
  assert.equal(
    new URL(verifiedLandingFacts.designApp.href).searchParams.get('fileId'),
    'asyra-framework-demo'
  )
  assert.doesNotMatch(
    verifiedLandingFacts.designApp.href,
    /-projects\.vercel\.app/
  )
})

test('three complementary starting paths are distinct and exact', () => {
  const entry = read('components/landing-entry-evidence.tsx')
  ;[
    ['/docs/start/create-design-app', 'Start with a working product'],
    ['/docs', 'Learn the Framework'],
    ['/docs/start/custom-composition', 'Compose a custom product']
  ].forEach(([href, label]) => {
    assert.match(entry, new RegExp(`href="${href}"`))
    assert.match(entry, new RegExp(label))
  })
  assert.match(entry, /create-asyra-design-app/)
  assert.match(entry, /Runtime Atlas/)
  assert.doesNotMatch(entry, /examples|\/examples/i)
  assert.match(entry, /App-owned information model/)
})

test('reference product stays separate from Framework authority', () => {
  const entry = read('components/landing-entry-evidence.tsx')
  assert.match(entry, /Reference product, not Framework authority/)
  assert.match(entry, /verifiedLandingFacts\.designApp\.href/)
  assert.match(entry, /verifiedLandingFacts\.designApp\.title/)
  assert.match(
    entry,
    /Verified \{verifiedLandingFacts\.designApp\.verifiedAt\}/
  )
  assert.doesNotMatch(entry, /-projects\.vercel\.app|preview\.vercel\.app/)
})

test('release and policy links derive from the accepted bundle and project sources', () => {
  const entry = read('components/landing-entry-evidence.tsx')
  assert.match(entry, /bundle\.release\.status/)
  assert.match(entry, /bundle\.release\.family/)
  assert.match(entry, /bundle\.release\.packageCount/)
  assert.match(entry, /Publication is not authorized/)
  assert.doesNotMatch(entry, />19 public packages</)
  ;[
    '/docs',
    '/releases',
    '/roadmap',
    '/docs/reference/support-release#security-reporting'
  ].forEach((href) => assert.match(entry, new RegExp(`href="${href}"`)))
  assert.match(entry, /bundle\.repositoryHref/)
  assert.match(entry, /sourceHref\(bundle, 'LICENSE'\)/)
  assert.match(
    compact(entry),
    /sourceHref\(\s*bundle, 'README\.md', '#support-and-contribution-policy'\s*\)/
  )
  assert.match(entry, /External issues and contributions are not accepted/)
  assert.doesNotMatch(entry, /Open an issue|Contribute|Submit a pull request/i)
})

test('Landing ends with entry paths and exact public evidence', () => {
  const page = read('app/page.tsx')
  const topologyAt = page.indexOf('<LandingTopology')
  const evidenceAt = page.indexOf('<LandingEntryEvidence')
  assert.ok(topologyAt !== -1 && topologyAt < evidenceAt)
  assert.match(page, /bundle=\{bundle\}/)

  const styles = read('app/globals.css')
  assert.match(styles, /\.landing-entry/)
  assert.match(styles, /\.landing-evidence/)
  assert.match(styles, /@media \(max-width: 390px\)/)
})
