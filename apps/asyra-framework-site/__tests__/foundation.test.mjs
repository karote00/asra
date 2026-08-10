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
  const landing = read('app/page.tsx')
  const atlas = read('app/atlas/page.tsx')
  ;['/docs', '/asyra-design', '/releases', '/roadmap', '/atlas'].forEach(
    (route) => assert.match(header, new RegExp(`href: '${route}'`))
  )
  assert.doesNotMatch(header, /\/examples|Examples/)
  assert.match(landing, /<LandingHero/)
  assert.match(landing, /<LandingEntryEvidence/)
  assert.match(atlas, /<RuntimeAtlas\s*\/>/)
  assert.match(atlas, /Operate six real Asyra browser cases/)
})

test('navigation and visual tokens preserve accessibility and asset boundaries', () => {
  const navigation = read('components/site-navigation.tsx')
  const styles = read('app/styles/foundation.css')
  const docsStyles = read('app/styles/docs.css')
  const landingStyles = read('app/styles/landing.css')
  assert.match(navigation, /aria-modal="true"/)
  assert.match(navigation, /event.key !== 'Escape'/)
  assert.match(navigation, /triggerRef\.current\?\.focus\(\)/)
  assert.match(styles, /--cosmos: #020b15/)
  assert.match(styles, /--cosmos-elevated: #071522/)
  assert.match(styles, /--surface: #f3eee7/)
  assert.match(styles, /--coral: #ff806c/)
  assert.match(styles, /--cyan: #68ddec/)
  assert.match(styles, /--violet: #a56dff/)
  assert.match(styles, /--amber: #f2b64f/)
  assert.match(styles, /color-scheme: dark/)
  assert.match(styles, /body[^}]*background:[^;]*var\(--cosmos\)/s)
  assert.match(styles, /\.site-header[^}]*background:[^;]*var\(--cosmos\)/s)
  assert.match(
    docsStyles,
    /\.docs-layout[^}]*background:[^;]*var\(--surface\)/s
  )
  assert.match(
    landingStyles,
    /\.landing-hero[^}]*background:[^;]*var\(--cosmos\)/s
  )
  assert.match(read('components/site-header.tsx'), /Explore/)
  assert.match(read('components/site-header.tsx'), /BrandLogo/)
  assert.match(read('components/brand-logo.tsx'), /viewBox="0 0 154 32"/)
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
      styles,
      docsStyles,
      landingStyles,
      read('app/layout.tsx')
    ].join('\n'),
    /visual-reimagine|\.png|\.jpg|\.webp/i
  )
})
