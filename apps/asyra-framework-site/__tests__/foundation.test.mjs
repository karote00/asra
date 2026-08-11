import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (filePath) => fs.readFileSync(path.join(appRoot, filePath), 'utf8')

test('workspace freezes the exact approved site toolchain', () => {
  const manifest = JSON.parse(read('package.json'))
  assert.deepEqual(manifest.engines, { node: '24.x' })
  assert.deepEqual(manifest.dependencies, {
    '@asyra/ai-agent-runtime': 'workspace:*',
    '@asyra/collaboration': 'workspace:*',
    '@asyra/core': 'workspace:*',
    '@asyra/factory': 'workspace:*',
    '@asyra/feature-system': 'workspace:*',
    '@asyra/reactive-events': 'workspace:*',
    'lucide-react': '1.31.0',
    next: '16.3.0',
    react: '19.1.0',
    'react-dom': '19.1.0'
  })
  assert.equal(manifest.devDependencies.tailwindcss, '4.3.3')
  assert.equal(manifest.devDependencies['@tailwindcss/postcss'], '4.3.3')
})

test('foundation exposes exact public destinations and accepted child surfaces', () => {
  const header = read('components/site-header.tsx')
  const footer = read('components/site-footer.tsx')
  const publicNavigation = `${header}\n${footer}`
  const landing = read('app/page.tsx')
  const atlas = read('app/atlas/page.tsx')
  ;['/docs', '/asyra-design', '/releases', '/roadmap', '/atlas'].forEach(
    (route) =>
      assert.match(publicNavigation, new RegExp(route.replace('/', '\\/')))
  )
  assert.doesNotMatch(header, /\/examples|Examples/)
  assert.match(landing, /<LandingHero/)
  assert.match(landing, /<LandingEntryEvidence/)
  assert.match(atlas, /<RuntimeAtlas\s*\/>/)
  assert.match(atlas, /Operate six real Asyra browser cases/)
})

test('navigation and visual tokens preserve accessibility and asset boundaries', () => {
  const navigation = read('components/site-navigation.tsx')
  const referenceStyles = read('app/styles/reference-v2.css')
  const styles = `${read('app/styles/foundation.css')}\n${referenceStyles}`
  const docsStyles = read('app/styles/docs.css')
  const landingStyles = read('app/styles/landing.css')
  const action = read('components/site-header-action.tsx')
  assert.match(navigation, /aria-modal="true"/)
  assert.match(navigation, /event.key !== 'Escape'/)
  assert.match(navigation, /triggerRef\.current\?\.focus\(\)/)
  assert.match(referenceStyles, /--cosmos: #020a13/)
  assert.match(referenceStyles, /--cosmos-elevated: #06131f/)
  assert.match(referenceStyles, /--surface: #f1ece4/)
  assert.match(referenceStyles, /--coral: #ff735c/)
  assert.match(referenceStyles, /--cyan: #62d7eb/)
  assert.match(referenceStyles, /--violet: #9a6ae8/)
  assert.match(referenceStyles, /--amber: #efa63d/)
  assert.match(styles, /color-scheme: dark/)
  assert.match(referenceStyles, /body[^}]*background-image:/s)
  assert.match(
    referenceStyles,
    /\.site-header[^}]*background:[^;]*rgba\(2, 10, 19/s
  )
  assert.match(
    docsStyles,
    /\.docs-layout[^}]*background:[^;]*var\(--surface\)/s
  )
  assert.match(
    landingStyles,
    /\.landing-hero[^}]*background:[^;]*var\(--cosmos\)/s
  )
  assert.match(action, /pathname === '\/'/)
  assert.match(action, /Explore/)
  assert.match(action, /site-header__utility/)
  assert.match(read('components/site-header.tsx'), /BrandLogo/)
  assert.match(read('components/brand-logo.tsx'), /viewBox="0 0 124 24"/)
  assert.equal(
    (read('components/brand-logo.tsx').match(/brand-logo__letter/g) ?? [])
      .length,
    5
  )
  assert.match(read('components/galaxy-map.tsx'), /galaxy-map__core-mark/)
  assert.doesNotMatch(
    [
      read('components/site-frame.tsx'),
      read('components/foundation-browser-support.tsx')
    ].join('\n'),
    /working sheet/i
  )
  assert.match(read('components/site-footer.tsx'), /Visual \+ machine/)
  assert.match(styles, /min-width: 320px/)
  assert.match(styles, /prefers-reduced-motion: reduce/)
  assert.match(styles, /forced-colors: active/)
  assert.doesNotMatch(
    [
      navigation,
      action,
      styles,
      docsStyles,
      landingStyles,
      read('app/layout.tsx')
    ].join('\n'),
    /visual-reimagine|\.png|\.jpg|\.webp/i
  )
})

test('brand wordmark uses the compact rounded reference geometry', () => {
  const brandLogo = read('components/brand-logo.tsx')

  assert.match(brandLogo, /viewBox="0 0 124 24"/)
  assert.match(brandLogo, /strokeLinecap="round"/)
  assert.match(brandLogo, /strokeLinejoin="round"/)
  assert.match(brandLogo, /strokeWidth="2\.5"/)
  assert.match(
    brandLogo,
    /data-letter="S"[\s\S]*?<path d="[^"]*[CQ][^"]*" \/>/i
  )
  assert.match(
    brandLogo,
    /data-letter="R"[\s\S]*?<path d="[^"]*[CQ][^"]*" \/>/i
  )
})
