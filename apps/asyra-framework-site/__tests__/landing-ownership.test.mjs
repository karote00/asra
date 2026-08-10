import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (filePath) => fs.readFileSync(path.join(appRoot, filePath), 'utf8')

test('owner summaries remain complete before interactive selection', () => {
  const explorer = read('components/landing-ownership-explorer.tsx')
  ;['Framework', 'Preset', 'App'].forEach((owner) =>
    assert.match(explorer, new RegExp(`label: '${owner}'`))
  )
  assert.match(explorer, /Framework owns reusable infrastructure/)
  assert.match(explorer, /Preset offers optional official defaults/)
  assert.match(explorer, /App owns domain knowledge and product policy/)
  assert.match(explorer, /landing-ownership__summary/)
  assert.doesNotMatch(explorer, /@asyra\//)
})

test('owner selection is a bounded accessible tab interaction', () => {
  const explorer = read('components/landing-ownership-explorer.tsx')
  assert.match(explorer, /^'use client'/)
  assert.match(explorer, /role="tablist"/)
  assert.match(explorer, /role="tab"/)
  assert.match(explorer, /aria-selected=/)
  assert.match(explorer, /role="tabpanel"/)
  assert.match(explorer, /ArrowLeft|ArrowUp/)
  assert.match(explorer, /ArrowRight|ArrowDown/)
  assert.match(explorer, /event\.key === 'Home'/)
  assert.match(explorer, /event\.key === 'End'/)
  assert.match(explorer, /\.focus\(\)/)
  assert.match(explorer, /useState/)
  assert.doesNotMatch(explorer, /useEffect|fetch\(|localStorage|sessionStorage/)
})

test('technical topology preserves transaction, canonical owner, and projection boundaries', () => {
  const topology = read('components/landing-topology.tsx')
  const steps = [
    'Intent',
    'Feature',
    'Common API',
    'Factory transaction',
    'Canonical owners',
    'Projection',
    'Accepted result'
  ]
  steps.forEach((label) => assert.match(topology, new RegExp(label)))
  assert.match(topology, /Projection observes; it does not own/)
  assert.match(topology, /Preset/)
  assert.match(topology, /Provider/)
  assert.match(topology, /Optional composition/)
  assert.match(topology, /landing-topology__optional/)
  assert.match(topology, /href="\/atlas"/)
  assert.match(topology, /Runtime Atlas owns the executable proof/)
  assert.doesNotMatch(
    topology,
    /duration|elapsed|event ledger|transaction id|mock result|success in \d+/i
  )
})

test('ownership and route stay readable without client execution', () => {
  const explorer = read('components/landing-ownership-explorer.tsx')
  const topology = read('components/landing-topology.tsx')
  assert.match(explorer, /owners\.map/)
  assert.match(topology, /<ol/)
  assert.doesNotMatch(topology, /['"]use client['"]|useEffect|useState/)
  assert.doesNotMatch(topology, /@asyra\//)
})

test('Landing composes narrative, ownership, and topology in progressive order', () => {
  const page = read('app/page.tsx')
  const narrativeAt = page.indexOf('<LandingStory')
  const ownershipAt = page.indexOf('<LandingOwnershipExplorer')
  const topologyAt = page.indexOf('<LandingTopology')
  assert.ok(narrativeAt !== -1)
  assert.ok(narrativeAt < ownershipAt)
  assert.ok(ownershipAt < topologyAt)

  const styles = read('app/globals.css')
  assert.match(styles, /\.landing-ownership/)
  assert.match(styles, /\.landing-topology/)
  assert.match(
    styles,
    /\.landing-topology__optional[\s\S]*border-style: dashed/
  )
  assert.match(styles, /prefers-reduced-motion: reduce/)
})
