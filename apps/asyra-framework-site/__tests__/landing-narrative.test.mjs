import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (filePath) => fs.readFileSync(path.join(appRoot, filePath), 'utf8')
const compact = (value) => value.replace(/\s+/g, ' ')

test('Landing begins with an outcome anyone can understand before technical language', () => {
  const page = read('app/page.tsx')
  const hero = read('components/landing-hero.tsx')
  const galaxy = read('components/galaxy-map.tsx')
  const source = `${page}\n${hero}\n${galaxy}`

  assert.match(
    compact(hero),
    /<span>Build worlds<\/span> <span>from information\.<\/span>/
  )
  assert.match(
    compact(hero),
    /Asyra is deterministic infrastructure for executable information models\. You bring domain expertise\. We provide the runtime that makes it real\./
  )
  assert.match(hero, /Start with a product/)
  assert.match(hero, /See Asyra in 90 seconds/)
  assert.match(hero, /landing-galaxy/)
  assert.match(galaxy, /galaxy-map__core-mark/)
  assert.equal((galaxy.match(/className="galaxy-map__orbit"/g) ?? []).length, 7)

  const promiseAt = source.indexOf('<span>Build worlds</span>')
  const firstTechnicalTerm = Math.min(
    ...['Framework', 'Preset', 'Provider', 'API'].map((term) => {
      const index = source.indexOf(term)
      return index === -1 ? Number.POSITIVE_INFINITY : index
    })
  )
  assert.ok(promiseAt !== -1 && promiseAt < firstTechnicalTerm)
})

test('Landing keeps all beginner actions in semantic server-rendered order', () => {
  const hero = read('components/landing-hero.tsx')
  const entries = [
    ['/docs/start/create-design-app', 'Start with a product'],
    ['/docs/start/custom-composition', 'Build your own system'],
    ['/atlas', 'See Asyra in 90 seconds']
  ]

  entries.forEach(([href, label]) => {
    assert.match(hero, new RegExp(`href="${href}"`))
    assert.match(hero, new RegExp(label))
  })
  assert.doesNotMatch(hero, /['"]use client['"]/)
  assert.doesNotMatch(hero, /onClick=|onMouse|useEffect|useState/)
})

test('possibility field identifies App-owned domains and future work without built-in claims', () => {
  const field = read('components/landing-possibility-field.tsx')
  ;[
    'Design tools',
    'Whiteboards',
    'BIM and digital twins',
    'VR environments',
    'Industrial simulation',
    'Knowledge and decision products'
  ].forEach((label) => assert.match(field, new RegExp(label)))

  assert.match(field, /App-owned possibilities — not built-in features/)
  assert.match(field, /Roadmap/)
  assert.match(field, /machine-facing information products/i)
  assert.doesNotMatch(field, /headless|core kernel/i)
  assert.match(field, /<svg/)
  assert.match(field, /<(?:ol|ul)/)
  assert.doesNotMatch(field, /<canvas|<img|next\/image|\.png|\.jpg|\.webp/i)
})

test('Describe, Act, Verify tells one plain-language deterministic story', () => {
  const story = read('components/landing-story.tsx')
  const labels = ['Describe', 'Act', 'Verify']
  labels.forEach((label) =>
    assert.match(story, new RegExp(`label: '${label}'`))
  )
  assert.match(story, /Bring your domain/)
  assert.match(story, /Define what can happen/)
  assert.match(story, /Inspect every outcome/)
  assert.match(story, /same rules lead to the same accepted outcome/i)
  assert.doesNotMatch(story, /['"]use client['"]|useEffect|useState/)
})

test('Landing panorama is code-native, responsive, and motion-optional', () => {
  const page = read('app/page.tsx')
  const styles = `${read('app/styles/landing.css')}\n${read('app/styles/reference-v2.css')}`
  const components = [
    read('components/landing-hero.tsx'),
    read('components/galaxy-map.tsx'),
    read('components/landing-possibility-field.tsx'),
    read('components/landing-story.tsx')
  ].join('\n')

  assert.match(page, /<LandingHero/)
  assert.match(page, /<LandingPossibilityField/)
  assert.match(page, /<LandingStory/)
  assert.match(styles, /\.landing-hero/)
  assert.match(styles, /\.landing-possibility/)
  assert.match(styles, /\.landing-story/)
  assert.match(styles, /\.galaxy-map__spirals/)
  assert.match(styles, /@media \(max-width: 760px\)/)
  assert.match(styles, /prefers-reduced-motion: reduce/)
  assert.doesNotMatch(
    components,
    /<canvas|WebGL|requestAnimationFrame|setInterval/
  )
  assert.doesNotMatch(components, /\.png|\.jpg|\.jpeg|\.webp|https?:\/\//i)
})
