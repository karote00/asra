import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { env } from 'node:process'
import test from 'node:test'

const siteRoot = path.resolve(import.meta.dirname, '..')
const appRoot = path.join(siteRoot, 'app')

const readAppFile = (file) => readFile(path.join(appRoot, file), 'utf8')

const listFiles = async (directory) => {
  try {
    return (await readdir(directory, { recursive: true }))
      .filter((entry) => /\.[^.]+$/.test(entry))
      .sort()
  } catch (error) {
    if (error && error.code === 'ENOENT') return []
    throw error
  }
}

const localArtworkTest = env.LOCAL_ARTWORK_TESTS === '1' ? test : test.skip

test('the website preserves the accepted landing owner beside the supporting platform', async () => {
  const appFiles = (await listFiles(appRoot)).filter((entry) =>
    /\.(?:css|tsx|ts)$/.test(entry)
  )

  for (const ownerFile of [
    'error.tsx',
    'globals.css',
    'layout.tsx',
    'not-found.tsx',
    'page.tsx',
    'robots.ts',
    'sitemap.ts'
  ]) {
    assert.ok(appFiles.includes(ownerFile), ownerFile)
  }
  assert.ok(appFiles.includes('atlas/page.tsx'))
  assert.ok(appFiles.includes('docs/page.tsx'))
  assert.ok(appFiles.includes('releases/page.tsx'))
  assert.ok((await listFiles(path.join(siteRoot, 'components'))).length > 0)
  assert.ok((await listFiles(path.join(siteRoot, 'workers'))).length > 0)
  assert.ok(
    (await listFiles(path.join(siteRoot, 'lib'))).includes('site-origin.ts')
  )
})

test('the result-first narrative matches the approved V04 landing page', async () => {
  const page = await readAppFile('page.tsx')
  const pageText = page.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
  const requiredCopy = [
    'Build the tool your world needs.',
    'You bring the domain knowledge. AI builds with Asyra. Your tool',
    'One foundation. Any field.',
    'Examples, not limits.',
    'Add what your workflow needs without rebuilding the rest.',
    'Build each feature once. People and AI use the same action path.',
    'One source of truth across every feature and view.',
    'Prove it once. Keep what works.',
    'Keep validated work moving.',
    'What proves the idea becomes the starting point for the product.',
    'Bring your domain. Keep its logic.'
  ]

  for (const copy of requiredCopy) {
    assert.ok(pageText.includes(copy), `Missing approved copy: ${copy}`)
  }

  assert.equal((page.match(/Start building/g) ?? []).length, 2)
  assert.doesNotMatch(page, /site-header[\s\S]*button--compact/)
  assert.equal((page.match(/Try the demo/g) ?? []).length, 1)
  assert.equal((page.match(/\bDemo\s*<\/a>/g) ?? []).length, 1)
  for (const line of [
    'Build the tool',
    'your world needs.',
    'Add what your workflow',
    'needs without rebuilding',
    'Build each feature once.',
    'People and AI use the',
    'One source of truth across',
    'every feature and view.',
    'Bring your domain.',
    'Keep its logic.'
  ]) {
    assert.match(
      page,
      new RegExp(
        `<span className="reference-line">\\s*${line.replace('.', '\\.')}`
      )
    )
  }
  assert.doesNotMatch(page, /proof__detail|Asyra shows what changed/)
  assert.doesNotMatch(page, /[—–]/)
})

test('the PoC storyboard keeps validated work on one governed product path', async () => {
  const page = await readAppFile('page.tsx')
  const css = await readAppFile('globals.css')
  const illustrationFiles = await listFiles(
    path.join(siteRoot, 'public', 'illustrations')
  )
  const governanceStart = page.indexOf('<p className="poc-story__governance">')
  const panelsStart = page.indexOf('<div className="story-panels">')
  const traditionalPathStart = page.indexOf("key: 'traditional'")
  const asyraPathStart = page.indexOf("key: 'asyra'")
  const flowMapStart = page.indexOf('{pocStoryPaths.map((path) =>')
  const panelMapStart = page.indexOf(
    '{pocStoryPanels.map((panel) =>',
    flowMapStart
  )

  assert.match(page, /className="poc-story"/)
  assert.match(page, /id="how-it-works"/)
  assert.doesNotMatch(page, />\s*Workflow\s*<\/p>/)
  assert.doesNotMatch(page, /Workflow comparison/)
  assert.doesNotMatch(page, /Same PoC\. Two paths\./)
  assert.match(page, /const pocStoryPanels = \[/)
  assert.match(page, /const pocStoryPaths = \[/)
  assert.equal((page.match(/className="poc-story__legend"/g) ?? []).length, 1)
  assert.match(page, />Traditional</)
  assert.match(page, />With Asyra</)
  assert.match(page, /className="story-panels"/)
  assert.match(page, /className="story-flow__steps"/)
  assert.match(page, /className="story-flow__label"/)
  assert.match(page, /className="story-panel"/)
  assert.match(page, /story-flow--\$\{path\.key\}/)
  assert.match(page, /story-panel__scene--\$\{path\.key\}/)
  assert.doesNotMatch(page, /panel\.stage === '01'/)
  assert.match(page, /className="story-panel__artwork-frame"/)
  assert.match(page, /className="story-panel__artwork"/)
  assert.ok(traditionalPathStart < asyraPathStart)
  assert.ok(flowMapStart < panelMapStart)
  assert.match(page, /poc-storyboard-stage-01-traditional\.png/)
  assert.match(page, /poc-storyboard-stage-01-asyra\.png/)
  assert.doesNotMatch(page, /poc-storyboard-stage-01\.png/)
  assert.doesNotMatch(page, /StoryCharacter|StoryAction|StoryVignette/)
  assert.doesNotMatch(page, /className="story-vignette"/)
  assert.deepEqual(
    illustrationFiles.filter((file) =>
      /poc-storyboard-stage-\d{2}-(?:traditional|asyra)\.png$/.test(file)
    ),
    [
      'poc-storyboard-stage-01-asyra.png',
      'poc-storyboard-stage-01-traditional.png',
      'poc-storyboard-stage-02-asyra.png',
      'poc-storyboard-stage-02-traditional.png',
      'poc-storyboard-stage-03-asyra.png',
      'poc-storyboard-stage-03-traditional.png',
      'poc-storyboard-stage-04-asyra.png',
      'poc-storyboard-stage-04-traditional.png'
    ]
  )
  assert.equal((page.match(/traditional: \{/g) ?? []).length, 4)
  assert.equal((page.match(/asyra: \{/g) ?? []).length, 4)
  assert.doesNotMatch(
    page,
    /className="workflow-lane|className="workflow-step|story-panel__paths/
  )
  assert.match(page, /Domain \+ AI/)
  assert.match(page, /Real Feature/)
  assert.match(page, /Engineer review/)
  assert.doesNotMatch(page, /Same implementation/)
  assert.match(page, /Engineering still owns production readiness/)
  assert.match(page, /review, tests, security, and performance/)
  assert.ok(governanceStart > panelsStart)
  assert.doesNotMatch(page, /production-ready/i)

  assert.match(
    css,
    /\.story-flow__steps\s*\{[\s\S]*grid-template-columns: repeat\(4,/
  )
  assert.match(
    css,
    /@media \(max-width: 960px\)[\s\S]*\.story-flow__steps\s*\{[\s\S]*grid-template-columns: repeat\(2,/
  )
  assert.match(
    css,
    /@media \(max-width: 680px\)[\s\S]*\.story-flow__steps\s*\{[\s\S]*grid-template-columns: 1fr/
  )
  assert.match(
    css,
    /\.story-flow--asyra \.story-panel__header\s*\{[\s\S]*display: none/
  )
  assert.match(
    css,
    /\.story-panel__artwork-frame\s*\{[\s\S]*border: 2px solid[\s\S]*overflow: hidden/
  )
  assert.match(css, /\.story-panel__artwork\s*\{[\s\S]*inset: 0/)
  assert.match(css, /\.story-flow__label\s*\{[\s\S]*position: absolute/)
  assert.match(
    css,
    /@media \(max-width: 960px\)[\s\S]*\.poc-story__legend\s*\{[\s\S]*display: none[\s\S]*\.story-flow__label\s*\{[\s\S]*position: static/
  )
  assert.match(
    css,
    /\.poc-story__legend-swatch--traditional\s*\{[\s\S]*rgb\(220 36 27/
  )
  assert.match(
    css,
    /\.poc-story__legend-swatch--asyra\s*\{[\s\S]*rgb\(8 119 200/
  )
  assert.doesNotMatch(
    css,
    /\.story-panel__stage\s*\{[^}]*color: var\(--signal-red\)/
  )
  assert.doesNotMatch(
    css,
    /\.workflow-lane|\.workflow-step|\.story-panel__paths/
  )
})

test('the retired change-impact sections do not contribute to the landing narrative', async () => {
  const page = await readAppFile('page.tsx')

  assert.doesNotMatch(page, /ImpactPreview|proof--change|visible-change/i)
  assert.doesNotMatch(
    page,
    /Change one part|Know what it affects before you commit/i
  )
})

test('every navigation and CTA target is connected to the completed site', async () => {
  const page = await readAppFile('page.tsx')
  const anchors = page.match(/<a\b/g) ?? []
  const anchorsWithTargets = page.match(/<a\b[^>]*\bhref=/g) ?? []

  assert.equal(anchors.length, 13)
  assert.equal(anchorsWithTargets.length, anchors.length)
  assert.doesNotMatch(page, /href=["']\s*["']/)
  assert.doesNotMatch(page, /href=["']#["']/)
  assert.match(page, /href="\/docs"/)
  assert.match(page, /href="\/atlas"/)
  assert.match(page, /href="\/docs\/start\/custom-composition"/)
  assert.equal(
    (
      page.match(
        /href="https:\/\/asyra-design\.vercel\.app\/\?fileId=demo"/g
      ) ?? []
    ).length,
    2
  )
  assert.equal(
    (
      page.match(
        /<a\b(?=[^>]*href="https:\/\/asyra-design\.vercel\.app\/\?fileId=demo")(?=[^>]*target="_blank")(?=[^>]*rel="noopener noreferrer")[^>]*>/g
      ) ?? []
    ).length,
    2
  )
  assert.doesNotMatch(page, /href="#examples"|id="examples"/)
  assert.match(page, /id="domains"/)
  assert.match(page, /https:\/\/github\.com\/karote00\/asyra/)
})

test('the footer identifies its license without an open-source or company label', async () => {
  const source = [
    await readAppFile('page.tsx'),
    await readAppFile('layout.tsx'),
    await readAppFile('not-found.tsx')
  ].join('\n')
  const css = await readAppFile('globals.css')

  assert.match(source, /2026/)
  assert.match(source, /MIT License/)
  assert.doesNotMatch(source, /2025|Open source|Asyra Systems?|Inc\.|Company/i)
  assert.doesNotMatch(css, /\.project-identity a::before/)
})

test('metadata falls back to the canonical HTTPS origin', async () => {
  const source = await readFile(
    path.join(siteRoot, 'lib', 'site-origin.ts'),
    'utf8'
  )

  assert.ok(source.includes('https://asyra-framework.vercel.app'))
  assert.doesNotMatch(source, /http:\/\/127\.0\.0\.1:3020/)
})

test('metadata identifies the Framework for canvas-based and domain-driven tools', async () => {
  const layout = await readAppFile('layout.tsx')

  assert.match(
    layout,
    /Asyra - Framework for canvas-based and domain-driven tools/
  )
  assert.match(layout, /canvas-based editors/)
  assert.match(layout, /visual tools/)
  assert.match(layout, /BIM workspaces/)
  assert.match(layout, /domain products/)
})

test('the public llms discovery surface mirrors the generated documentation inventory', async () => {
  const websiteLlms = await readFile(
    path.join(siteRoot, 'public', 'llms.txt'),
    'utf8'
  )
  const generatedLlms = await readFile(
    path.join(siteRoot, '..', '..', 'docs', 'public', 'llms.txt'),
    'utf8'
  )

  assert.equal(websiteLlms, generatedLlms)
  assert.match(websiteLlms, /^# Asyra Framework/m)
  assert.doesNotMatch(websiteLlms, /docs\/ai\//)
})

test('local artwork sources are Git-ignored and run only through the opt-in artwork gate', async () => {
  const ignore = await readFile(
    path.join(siteRoot, '..', '..', '.gitignore'),
    'utf8'
  )
  const packageJson = JSON.parse(
    await readFile(path.join(siteRoot, 'package.json'), 'utf8')
  )

  assert.match(ignore, /^apps\/asyra-framework-site\/artwork\/$/m)
  assert.match(
    ignore,
    /^apps\/asyra-framework-site\/public\/illustrations\/\*$/m
  )
  assert.match(
    ignore,
    /^!apps\/asyra-framework-site\/public\/illustrations\/\*-photoroom-\*\.webp$/m
  )
  assert.match(
    ignore,
    /^!apps\/asyra-framework-site\/public\/illustrations\/poc-storyboard-stage-\*\.png$/m
  )
  assert.equal(
    packageJson.scripts['test:artwork:local'],
    'LOCAL_ARTWORK_TESTS=1 yarn test:local'
  )
  assert.doesNotMatch(packageJson.scripts['test:ci'], /LOCAL_ARTWORK/)
})

test('production includes only the twenty-two selected Photoroom derivatives', async () => {
  const page = await readAppFile('page.tsx')
  const assets = await listFiles(path.join(siteRoot, 'public', 'illustrations'))
  const activeAssets = assets.filter((asset) => asset.includes('-photoroom-'))

  assert.deepEqual(activeAssets, [
    'closing-core-v09-photoroom-1280.webp',
    'closing-core-v09-photoroom-1536.webp',
    'closing-core-v09-photoroom-960.webp',
    'domain-rail-v08-desktop-photoroom-1600.webp',
    'domain-rail-v08-desktop-photoroom-2400.webp',
    'domain-rail-v08-desktop-photoroom-800.webp',
    'domain-rail-v08-desktop-photoroom-row-1-1200.webp',
    'domain-rail-v08-desktop-photoroom-row-1-800.webp',
    'domain-rail-v08-desktop-photoroom-row-2-1200.webp',
    'domain-rail-v08-desktop-photoroom-row-2-800.webp',
    'grow-photoroom-1200.webp',
    'grow-photoroom-1518.webp',
    'grow-photoroom-720.webp',
    'hero-core-v08-desktop-photoroom-1080.webp',
    'hero-core-v08-desktop-photoroom-1400.webp',
    'hero-core-v08-desktop-photoroom-720.webp',
    'one-source-v08-desktop-photoroom-1280.webp',
    'one-source-v08-desktop-photoroom-1536.webp',
    'one-source-v08-desktop-photoroom-720.webp',
    'same-path-photoroom-1280.webp',
    'same-path-photoroom-1774.webp',
    'same-path-photoroom-720.webp'
  ])
  for (const name of [
    'hero-core-v08-desktop-photoroom',
    'domain-rail-v08-desktop-photoroom',
    'grow-photoroom',
    'same-path-photoroom',
    'one-source-v08-desktop-photoroom',
    'closing-core-v09-photoroom'
  ]) {
    assert.match(page, new RegExp(`name=["']${name}["']`))
  }
  assert.match(page, /domain-rail-v08-desktop-photoroom-row-1-800\.webp/)
  assert.match(page, /name="domain-rail-v08-desktop-photoroom-row-2"/)
})

localArtworkTest(
  'local design history preserves prior derivatives without selecting them',
  async () => {
    const page = await readAppFile('page.tsx')
    const assets = await listFiles(
      path.join(siteRoot, 'public', 'illustrations')
    )

    const v04Assets = assets.filter((asset) => asset.includes('-v04-'))
    assert.deepEqual(v04Assets, [
      'closing-core-v04-1440.webp',
      'closing-core-v04-480.webp',
      'closing-core-v04-960.webp',
      'domain-rail-v04-1280.webp',
      'domain-rail-v04-2048.webp',
      'domain-rail-v04-3200.webp',
      'grow-v04-1280.webp',
      'grow-v04-1920.webp',
      'grow-v04-720.webp',
      'hero-core-v04-1536.webp',
      'hero-core-v04-2400.webp',
      'hero-core-v04-960.webp',
      'one-source-v04-1280.webp',
      'one-source-v04-1920.webp',
      'one-source-v04-720.webp',
      'same-path-v04-1280.webp',
      'same-path-v04-1920.webp',
      'same-path-v04-720.webp',
      'visible-change-v04-1280.webp',
      'visible-change-v04-1920.webp',
      'visible-change-v04-720.webp'
    ])
    const v05Assets = assets.filter((asset) => asset.includes('-v05-'))
    assert.deepEqual(v05Assets, [
      'closing-core-v05-1440.webp',
      'closing-core-v05-480.webp',
      'closing-core-v05-960.webp',
      'domain-rail-v05-1600.webp',
      'domain-rail-v05-3200.webp',
      'domain-rail-v05-4800.webp',
      'grow-v05-1280.webp',
      'grow-v05-1920.webp',
      'grow-v05-720.webp',
      'hero-core-v05-1536.webp',
      'hero-core-v05-2400.webp',
      'hero-core-v05-960.webp',
      'one-source-v05-1280.webp',
      'one-source-v05-1920.webp',
      'one-source-v05-720.webp',
      'same-path-v05-1280.webp',
      'same-path-v05-1920.webp',
      'same-path-v05-720.webp',
      'visible-change-v05-1280.webp',
      'visible-change-v05-1920.webp',
      'visible-change-v05-720.webp'
    ])
    const v06Assets = assets.filter((asset) => asset.includes('-v06-'))
    assert.deepEqual(v06Assets, [
      'closing-core-v06-1254.webp',
      'closing-core-v06-480.webp',
      'closing-core-v06-960.webp',
      'domain-rail-v06-1600.webp',
      'domain-rail-v06-3200.webp',
      'domain-rail-v06-4800.webp',
      'grow-v06-1200.webp',
      'grow-v06-1500.webp',
      'grow-v06-720.webp',
      'hero-core-v06-1080.webp',
      'hero-core-v06-1400.webp',
      'hero-core-v06-720.webp',
      'one-source-v06-1280.webp',
      'one-source-v06-1536.webp',
      'one-source-v06-720.webp',
      'same-path-v06-1280.webp',
      'same-path-v06-1774.webp',
      'same-path-v06-720.webp',
      'visible-change-v06-1280.webp',
      'visible-change-v06-1900.webp',
      'visible-change-v06-720.webp'
    ])
    const v07ClosingAssets = assets.filter((asset) =>
      asset.startsWith('closing-core-v07-')
    )
    assert.deepEqual(v07ClosingAssets, [
      'closing-core-v07-1440.webp',
      'closing-core-v07-2880.webp',
      'closing-core-v07-960.webp'
    ])
    const v08ClosingAssets = assets.filter((asset) =>
      asset.startsWith('closing-core-v08-')
    )
    assert.deepEqual(v08ClosingAssets, [
      'closing-core-v08-1440.webp',
      'closing-core-v08-2400.webp',
      'closing-core-v08-960.webp'
    ])
    const v09ClosingAssets = assets.filter(
      (asset) =>
        asset.startsWith('closing-core-v09-') && !asset.includes('-photoroom-')
    )
    assert.deepEqual(v09ClosingAssets, [
      'closing-core-v09-1280.webp',
      'closing-core-v09-1536.webp',
      'closing-core-v09-960.webp'
    ])
    const v12Assets = assets.filter((asset) => asset.includes('-v12-'))
    assert.deepEqual(v12Assets, [
      'closing-core-v12-1280.webp',
      'closing-core-v12-1536.webp',
      'closing-core-v12-960.webp',
      'domain-rail-v12-1600.webp',
      'domain-rail-v12-3200.webp',
      'domain-rail-v12-4800.webp',
      'domain-rail-v12-desktop-4800.webp',
      'grow-v12-1200.webp',
      'grow-v12-1500.webp',
      'grow-v12-720.webp',
      'hero-core-v12-1080.webp',
      'hero-core-v12-1400.webp',
      'hero-core-v12-720.webp',
      'hero-core-v12-desktop-1400.webp',
      'one-source-v12-1280.webp',
      'one-source-v12-1536.webp',
      'one-source-v12-720.webp',
      'one-source-v12-desktop-1536.webp',
      'same-path-v12-1280.webp',
      'same-path-v12-1774.webp',
      'same-path-v12-720.webp'
    ])
    for (const name of [
      'hero-core-v08-desktop-photoroom',
      'domain-rail-v08-desktop-photoroom',
      'grow-photoroom',
      'same-path-photoroom',
      'one-source-v08-desktop-photoroom',
      'closing-core-v09-photoroom'
    ]) {
      assert.match(page, new RegExp(`name=["']${name}["']`))
    }
    assert.doesNotMatch(page, /desktopName=/)
    assert.match(page, /srcSet=/)
    assert.doesNotMatch(page, /domainNames|domain-names/)
    assert.doesNotMatch(page, /<svg|<canvas|lucide|\.png/i)
  }
)

localArtworkTest(
  'the supplied Photoroom masters are immutable and build true-alpha responsive assets',
  async () => {
    const artworkRoot = path.join(siteRoot, 'artwork', 'photoroom')
    const expectedHashes = {
      'closing-core-v09-master-Photoroom.png':
        'b78f35da10509c6ed55eff32a8f319742f568dc9f88af347db5b3d2b7bd2de1e',
      'domain-rail-v08-desktop-master-Photoroom.png':
        'e9ef2874deffd9c2b7d7aea3f3230490fe7ebdce91fc4ef2833a111cd94d6465',
      'grow-master-Photoroom.png':
        '89ebbb065abd2ca431452a35445e4f9d1a13232e52d9472ebcdf9000f12c67ea',
      'hero-core-v08-desktop-master-Photoroom.png':
        'c8db8be4eef7fb04068f33eac7ce78e8eda9645970f9c9fe4cb7f2021f7ff71e',
      'one-source-v08-desktop-master-Photoroom.png':
        '4061698e80c1f6f600b1978f8401eb8661aab1472cf47169ebaab8dc7a1c330e',
      'same-path-master-Photoroom.png':
        '60d1071d0f879fdbd42d3c5d0a8cd1ce1c8a5c232d9a2d3f57b9ab96938c2384'
    }
    const assets = await listFiles(
      path.join(siteRoot, 'public', 'illustrations')
    )
    const expectedAssets = [
      'closing-core-v09-photoroom-1280.webp',
      'closing-core-v09-photoroom-1536.webp',
      'closing-core-v09-photoroom-960.webp',
      'domain-rail-v08-desktop-photoroom-1600.webp',
      'domain-rail-v08-desktop-photoroom-2400.webp',
      'domain-rail-v08-desktop-photoroom-800.webp',
      'domain-rail-v08-desktop-photoroom-row-1-1200.webp',
      'domain-rail-v08-desktop-photoroom-row-1-800.webp',
      'domain-rail-v08-desktop-photoroom-row-2-1200.webp',
      'domain-rail-v08-desktop-photoroom-row-2-800.webp',
      'grow-photoroom-1200.webp',
      'grow-photoroom-1518.webp',
      'grow-photoroom-720.webp',
      'hero-core-v08-desktop-photoroom-1080.webp',
      'hero-core-v08-desktop-photoroom-1400.webp',
      'hero-core-v08-desktop-photoroom-720.webp',
      'one-source-v08-desktop-photoroom-1280.webp',
      'one-source-v08-desktop-photoroom-1536.webp',
      'one-source-v08-desktop-photoroom-720.webp',
      'same-path-photoroom-1280.webp',
      'same-path-photoroom-1774.webp',
      'same-path-photoroom-720.webp'
    ]

    assert.deepEqual(await listFiles(artworkRoot), Object.keys(expectedHashes))
    assert.deepEqual(
      assets.filter((asset) => asset.includes('-photoroom-')),
      expectedAssets
    )
    for (const [filename, expectedHash] of Object.entries(expectedHashes)) {
      const master = await readFile(path.join(artworkRoot, filename))
      assert.equal(
        createHash('sha256').update(master).digest('hex'),
        expectedHash
      )
    }

    const builder = await readFile(
      path.join(siteRoot, 'scripts', 'build-photoroom-assets.py'),
      'utf8'
    )
    assert.match(builder, /def premultiplied_resize/)
    assert.match(builder, /def assert_true_alpha/)
    assert.match(builder, /domain-rail-structure-complete-v02\.png/)
    assert.match(builder, /\(0,\s*0,\s*1200,\s*325\)/)
    assert.match(builder, /\(1200,\s*0,\s*2400,\s*325\)/)
    assert.match(builder, /lossless=True/)
    assert.match(builder, /exact=True/)
  }
)

test('V12 uses deterministic GrabCut masks while preserving source-authored detail and shadows', async () => {
  const builder = await readFile(
    path.join(siteRoot, 'scripts', 'build-transparent-v12-assets.py'),
    'utf8'
  )
  const maskBuilder = await readFile(
    path.join(siteRoot, 'scripts', 'build-algorithmic-v12-masks.py'),
    'utf8'
  )
  const maskRequirements = await readFile(
    path.join(siteRoot, 'scripts', 'requirements-background-removal.txt'),
    'utf8'
  )
  const verifier = await readFile(
    path.join(siteRoot, 'scripts', 'verify-transparent-v12-assets.py'),
    'utf8'
  )

  for (const name of [
    'hero-core-v12',
    'hero-core-v12-desktop',
    'domain-rail-v12',
    'domain-rail-v12-desktop',
    'grow-v12',
    'same-path-v12',
    'one-source-v12',
    'one-source-v12-desktop',
    'closing-core-v12'
  ]) {
    assert.match(builder, new RegExp(`["']${name}["']`))
  }
  assert.match(builder, /maximum_difference\s*!=\s*0/)
  assert.match(builder, /decoded_alpha\[foreground\]\.min\(\)\)\s*<\s*250/)
  assert.match(builder, /max\(corner_alpha\)\s*>\s*2/)
  assert.match(builder, /def load_algorithmic_mask/)
  assert.match(builder, /algorithmic-masks/)
  assert.doesNotMatch(builder, /BiRefNet|professional_alpha/)
  assert.match(builder, /def source_shadow_plate/)
  assert.match(builder, /touches_subject/)
  assert.match(builder, /lossless=True/)
  assert.match(builder, /exact=True/)
  assert.match(maskBuilder, /cv2\.grabCut\(/)
  assert.match(maskBuilder, /cv2\.GC_INIT_WITH_MASK/)
  assert.match(maskBuilder, /sure_foreground/)
  assert.match(maskBuilder, /sure_background|GC_BGD/)
  assert.doesNotMatch(
    `${maskBuilder}\n${maskRequirements}`,
    /torch|transformers|huggingface|birefnet|rembg|onnxruntime/i
  )
  assert.match(maskRequirements, /opencv-python-headless/)
  assert.match(maskRequirements, /Pillow/)
  assert.match(maskRequirements, /scipy/)
  assert.match(verifier, /maximum_pipeline_difference\s*!=\s*0/)
  assert.match(verifier, /maximum_subject_difference\s*!=\s*0/)
  assert.match(verifier, /minimum_subject_alpha\s*<\s*250/)
  assert.match(verifier, /maximum_background_alpha\s*>\s*2/)
  assert.match(verifier, /TRUE ALPHA/)
  assert.match(verifier, /SECTION BACKGROUND/)
})

localArtworkTest(
  'V06 masters are immutable high-resolution redraws, not V04 or V05 pixel enlargements',
  async () => {
    const artworkRoot = path.join(siteRoot, 'artwork', 'v06')
    const expectedHashes = {
      'closing-core-master.png':
        '4ec3cdc18242e3a10e8cf2c0fbbf3e2b94ffa517d33c357170cbd39d83583053',
      'domain-card-master.png':
        '1dab863c2a865bc9a1487e6a3164fdf4c174607300d701e619ce90cf30e32f44',
      'domain-rail-background-master.png':
        '402b1e4832b33552c5262ec8319262c51b900a342b0b37beda542dbf88bb87c0',
      'domain-rail-master.png':
        '8108630634dff3cf2ace6038af67f9f91d65bace17edcdf7b91f3f89f80ff3e0',
      'grow-master.png':
        '01ed6a60c5aa40cb981a807aef36ff358ad69b19c94a2e5ef72d17490090dbb3',
      'hero-core-master.png':
        'fde2e6d788a6d175aa9a7b46bf3bbdd3cd4d3f7fccbdfaf638fc3e9af4e7cf81',
      'one-source-master.png':
        '0d745b9e21de08a1abb1ec63df34fc081d69fab9d3711c162aa39dce2f0a9930',
      'same-path-master.png':
        'a3e4ff6dc1f07f338ac11e30d1e4f8275d7a4c825195f3be514fa0c1be8d0b93',
      'visible-change-master.png':
        'c6f3179c94e6d290bcd445da2778b1b169badd2cbe204f33c8e0dc23c3027b7d'
    }

    assert.deepEqual(
      (await listFiles(artworkRoot)).filter((filename) =>
        filename.endsWith('-master.png')
      ),
      Object.keys(expectedHashes)
    )
    for (const [filename, expectedHash] of Object.entries(expectedHashes)) {
      const master = await readFile(path.join(artworkRoot, filename))
      assert.equal(
        createHash('sha256').update(master).digest('hex'),
        expectedHash
      )
    }

    const builder = await readFile(
      path.join(siteRoot, 'scripts', 'build-v06-assets.py'),
      'utf8'
    )
    assert.match(builder, /artwork.*v06/is)
    assert.match(builder, /build_domain_rail/)
    assert.match(builder, /domain-rail-background-master\.png/)
    assert.match(builder, /domain-card-master\.png/)
    assert.match(builder, /DOMAIN_LABEL_Y\s*=\s*362/)
    assert.match(builder, /DOMAIN_LABEL_FONT_SIZE\s*=\s*36/)
    assert.match(
      builder,
      /for index, \(label, icon\) in enumerate\(DOMAIN_ICONS\):[\s\S]*centered_label\([\s\S]*label,[\s\S]*DOMAIN_LABEL_FONT_SIZE,/
    )
    assert.match(builder, /requested width .* exceeds native master width/)
    assert.doesNotMatch(
      builder,
      new RegExp(
        'asyra-landing-v04-approved|artwork[ /\\\\]+v0[45]|REFERENCE\\.crop',
        'i'
      )
    )
  }
)

localArtworkTest(
  'the approved V09 closing concept is immutable and built from its exact reviewed master',
  async () => {
    const master = await readFile(
      path.join(siteRoot, 'artwork', 'v09', 'closing-core-v09-master.png')
    )

    assert.equal(
      createHash('sha256').update(master).digest('hex'),
      'c9b7d0eb316dda45277f0219c29aa4874089d214dd84ee52ac753850b9135ff7'
    )
    assert.match(
      await readFile(
        path.join(siteRoot, 'scripts', 'build-closing-v09-concept.py'),
        'utf8'
      ),
      /EXPECTED_MASTER_HASH/
    )
  }
)

localArtworkTest(
  'V07 rejected desktop masters remain preserved without being selected',
  async () => {
    const css = await readAppFile('globals.css')
    const assets = await listFiles(
      path.join(siteRoot, 'public', 'illustrations')
    )
    const artworkRoot = path.join(siteRoot, 'artwork', 'v07-desktop')
    const expectedMasterHashes = {
      'closing-grid-v07-desktop-master.png':
        '8114483578de1ce7d739dacf75cca3aaf85ef2df0cc2dd2f3500d910c36f1e98',
      'domain-rail-v07-desktop-master.png':
        '44762b86a3c163e51c05f5d7e5fb94308a79724ad1ab3eddefc4d367c5827f10',
      'grow-v07-desktop-master.png':
        '45ba3c092f32f1f665e3fd10b9834265fd2d7714a1b3a33ffbdd7b0b5f3f09a1',
      'hero-core-v07-desktop-master.png':
        '632037c510c87dce7d2b89552c3a1328e8751f8e5955869f2db39ebbe5b87866',
      'one-source-v07-desktop-master.png':
        '4e1a79c6e4b5078b71ca2ee12a1179d12b9cf8ff7eb17470248f3dd25ba0a71d',
      'visible-change-v07-desktop-master.png':
        'c37a919bbdd532c0f8c484599883891410bb7f5ad1721541d87ae58c543f5876'
    }
    const v07DesktopAssets = assets.filter((asset) =>
      asset.includes('-v07-desktop-')
    )

    assert.deepEqual(v07DesktopAssets, [
      'closing-grid-v07-desktop-2400.webp',
      'domain-rail-v07-desktop-4800.webp',
      'grow-v07-desktop-1500.webp',
      'hero-core-v07-desktop-1400.webp',
      'one-source-v07-desktop-1536.webp',
      'visible-change-v07-desktop-1900.webp'
    ])
    assert.deepEqual(
      (await listFiles(artworkRoot)).filter((filename) =>
        filename.endsWith('-master.png')
      ),
      Object.keys(expectedMasterHashes)
    )
    for (const [filename, expectedHash] of Object.entries(
      expectedMasterHashes
    )) {
      const master = await readFile(path.join(artworkRoot, filename))
      assert.equal(
        createHash('sha256').update(master).digest('hex'),
        expectedHash
      )
    }
    assert.doesNotMatch(
      css,
      /@media\s*\(min-width:\s*1101px\)[\s\S]*closing-grid-v07-desktop-2400\.webp/
    )

    const builder = await readFile(
      path.join(siteRoot, 'scripts', 'build-v07-desktop-assets.py'),
      'utf8'
    )
    for (const contract of [
      'compose_raised_blue_fastener',
      'draw_eight_direction_face',
      'draw_round_center',
      'compose_grow_reservoir',
      'enhance_topographic_relief',
      'draw_aligned_legend',
      'build_closing_measurement_grid'
    ]) {
      assert.match(builder, new RegExp(`def ${contract}\\(`))
    }
    assert.match(builder, /DOMAIN_LABEL_FONT_SIZE\s*=\s*36/)
    assert.match(builder, /V07_DESKTOP_WIDTHS/)
    assert.doesNotMatch(
      builder,
      new RegExp('asyra-landing-v04-approved|REFERENCE\\.crop', 'i')
    )
  }
)

localArtworkTest(
  'V08 desktop corrections remain preserved after the Photoroom sources replace them',
  async () => {
    const page = await readAppFile('page.tsx')
    const assets = await listFiles(
      path.join(siteRoot, 'public', 'illustrations')
    )
    const artworkRoot = path.join(siteRoot, 'artwork', 'v08-desktop')
    const expectedMasterHashes = {
      'domain-rail-v08-desktop-master.png':
        '8fcf98e56dec188c2268500eb4d13404a2ccc52e7c4b22057c87ed3d213bcf40',
      'grow-v08-desktop-master.png':
        '29d75186a45e1119075283aa9793a4f3e8b2cd39240a84e479649216f09ae839',
      'hero-core-v08-desktop-master.png':
        '9a254630b95c81b1f40dafa3b4eae49a65674cbbe38a1d5edf80dbbe7e7c4415',
      'one-source-v08-desktop-master.png':
        'aad7bc8d6d1243457328887ade6033e77fc86d23af1fc3436cebec94ce785249',
      'visible-change-v08-desktop-master.png':
        '68d553f655fc36e5a1c8e9ab5da26c5cf3ad0f314d2adfd8db99b33e9e57d0f4'
    }
    const v08DesktopAssets = assets.filter(
      (asset) =>
        asset.includes('-v08-desktop-') && !asset.includes('-photoroom-')
    )

    assert.deepEqual(v08DesktopAssets, [
      'domain-rail-v08-desktop-4800.webp',
      'grow-v08-desktop-1500.webp',
      'hero-core-v08-desktop-1400.webp',
      'one-source-v08-desktop-1536.webp',
      'visible-change-v08-desktop-1900.webp'
    ])
    assert.deepEqual(
      (await listFiles(artworkRoot)).filter((filename) =>
        filename.endsWith('-master.png')
      ),
      Object.keys(expectedMasterHashes)
    )
    for (const [filename, expectedHash] of Object.entries(
      expectedMasterHashes
    )) {
      const master = await readFile(path.join(artworkRoot, filename))
      assert.equal(
        createHash('sha256').update(master).digest('hex'),
        expectedHash
      )
    }
    assert.doesNotMatch(page, /desktopName=/)

    const builder = await readFile(
      path.join(siteRoot, 'scripts', 'build-v08-desktop-assets.py'),
      'utf8'
    )
    for (const contract of [
      'build_hero',
      'draw_reference_domain_icons',
      'restore_reference_domain_rail',
      'compose_integrated_grow_channel',
      'relocate_hero_top_connector',
      'restore_one_source_depth',
      'compose_consistent_visible_change',
      'remove_added_plate_surface_frame',
      'draw_panel_seams',
      'visible_change_public_mask',
      'verify_v08_contract'
    ]) {
      assert.match(builder, new RegExp(`def ${contract}\\(`))
    }
    assert.match(builder, /V08_DESKTOP_WIDTHS/)
    assert.match(builder, /V05_ARTWORK = SITE_ROOT \/ "artwork" \/ "v05"/)
    assert.match(builder, /def compose_hero\([\s\S]*V05_ARTWORK/)
    assert.match(builder, /HERO_CENTERLINE_X\s*=\s*693/)
    assert.match(builder, /return compose_hero\(relocate_connector=True\)/)
    assert.match(builder, new RegExp('asyra-landing-original-design-4x\\.png'))
    assert.match(
      builder,
      /DOMAIN_RAIL_REFERENCE_CROP = \(0, 2451, 3456, 2919\)/
    )
    assert.match(builder, /REFERENCE_DOMAIN_CARD_X_BOUNDS/)
    assert.match(builder, /ONE_SOURCE_LABEL_REGIONS/)
    assert.match(builder, /ONE_SOURCE_DIAGRAM_REGIONS/)
    assert.match(
      builder,
      /return compose_one_source\(28, \(255, 255, 255\), 184, 569, scale_diagrams=True\)/
    )
    assert.match(
      builder,
      /return compose_one_source\(18, \(242, 239, 232\), 167, 552\)/
    )
    assert.match(builder, /scale_one_source_diagram\([\s\S]*0\.70/)
    assert.match(builder, /for box in ONE_SOURCE_DIAGRAM_REGIONS/)
    assert.match(builder, /use_panel_seams:\s*bool\s*=\s*True/)
    assert.match(builder, /VISIBLE_CHANGE_SEAM_REGIONS/)
    assert.match(builder, /VISIBLE_CHANGE_SURFACE_FRAME_REGIONS/)
    assert.match(builder, /public_image\.save\([\s\S]*lossless=True/)
    assert.doesNotMatch(
      builder,
      /DOMAIN_RAIL_EDGE_FEATHER|anchor_domain_rail_edges/
    )
    for (const label of [
      'DESIGN',
      'PHOTOGRAPHY',
      'RESEARCH',
      'EDUCATION',
      'MEDIA',
      'OPERATIONS'
    ]) {
      assert.match(
        builder,
        new RegExp(`REFERENCE_DOMAIN_ICON_BOUNDS[\\s\\S]*${label}`)
      )
    }
  }
)

localArtworkTest(
  'V09 rejected Grow restoration remains preserved without being selected',
  async () => {
    const assets = await listFiles(
      path.join(siteRoot, 'public', 'illustrations')
    )
    const artworkRoot = path.join(siteRoot, 'artwork', 'v09-desktop')
    const v04Reference = await readFile(
      path.join(siteRoot, 'public', 'illustrations', 'grow-v04-1920.webp')
    )

    assert.equal(
      createHash('sha256').update(v04Reference).digest('hex'),
      '490ea5da4235ce86a07aff7e2a7749710537ee3c87364b7a6482603388ae5761'
    )
    assert.deepEqual(
      assets.filter((asset) => asset.includes('grow-v09-desktop-')),
      ['grow-v09-desktop-1500.webp']
    )
    for (const [filename, expectedHash] of Object.entries({
      'grow-v09-desktop-master.png':
        '4843e4e8f7b5ca5a116a46f7b2359a5d61361760f73ab2f5194e34c84bd03ef2',
      'grow-v09-traced-connector.png':
        'b6f721df220ace093a7ecb709a42211d1ae7f72dd5b0c95762444f00d1dcd365'
    })) {
      const artifact = await readFile(path.join(artworkRoot, filename))
      assert.equal(
        createHash('sha256').update(artifact).digest('hex'),
        expectedHash
      )
    }

    const builder = await readFile(
      path.join(siteRoot, 'scripts', 'build-v09-grow-desktop.py'),
      'utf8'
    )
    assert.match(builder, /grow-v04-1920\.webp/)
    assert.match(builder, /grow-master\.png/)
    for (const contract of [
      'extract_approved_connector',
      'restore_reference_pixels',
      'sample_reference_color',
      'render_traced_connector',
      'fit_connector_to_v06_anchors',
      'verify_v09_against_reference'
    ]) {
      assert.match(builder, new RegExp(`def ${contract}\\(`))
    }
    assert.match(builder, /REFERENCE_TRACE/)
    assert.doesNotMatch(builder, /imagegen|generated_images|grow-v05/i)
  }
)

localArtworkTest(
  'V10 rejected procedural Grow remains preserved without being selected',
  async () => {
    const page = await readAppFile('page.tsx')
    const assets = await listFiles(
      path.join(siteRoot, 'public', 'illustrations')
    )
    const artworkRoot = path.join(siteRoot, 'artwork', 'v10-desktop')

    assert.deepEqual(
      assets.filter((asset) => asset.includes('grow-v10-desktop-')),
      ['grow-v10-desktop-1500.webp']
    )
    assert.doesNotMatch(page, /desktopName=["']grow-v10-desktop["']/)
    for (const [filename, expectedHash] of Object.entries({
      'grow-v10-desktop-master.png':
        'afbc06c9d82bcc96d413a2a1a5337629912d68e6a787c802216083fe888a40cd',
      'grow-v10-traced-connector.png':
        'ae7c7c87e40747e1246576e03e4545a1ce437c71b7d52ba1886e31d79ce4ee51'
    })) {
      const artifact = await readFile(path.join(artworkRoot, filename))
      assert.equal(
        createHash('sha256').update(artifact).digest('hex'),
        expectedHash
      )
    }

    const builder = await readFile(
      path.join(siteRoot, 'scripts', 'build-v10-grow-desktop.py'),
      'utf8'
    )
    assert.match(builder, /grow-v04-1920\.webp/)
    assert.match(builder, /grow-master\.png/)
    assert.match(builder, /REFERENCE_LAYERS/)
    for (const layer of [
      'upper_trough',
      'center_pipe',
      'lower_reservoir',
      'bottom_support',
      'left_chrome_collar',
      'middle_clamp',
      'right_clamp'
    ]) {
      assert.match(builder, new RegExp(`["']${layer}["']`))
    }
    for (const contract of [
      'measure_reference_layers',
      'sample_reference_band',
      'render_reference_layer',
      'render_asymmetric_reservoir',
      'render_single_center_tube',
      'render_distinct_collar',
      'verify_v10_layer_contract',
      'verify_rendered_connector_profile'
    ]) {
      assert.match(builder, new RegExp(`def ${contract}\\(`))
    }
    assert.match(builder, /SINGLE_CENTER_TUBE_Y\s*=\s*117/)
    assert.match(builder, /SINGLE_CENTER_TUBE_HEIGHT\s*=\s*4/)
    assert.doesNotMatch(builder, /imagegen|generated_images|grow-v05/i)
  }
)

localArtworkTest(
  'V11 Grow restoration remains preserved while the page selects the supplied transparent Grow source',
  async () => {
    const page = await readAppFile('page.tsx')
    const assets = await listFiles(
      path.join(siteRoot, 'public', 'illustrations')
    )
    const artworkRoot = path.join(siteRoot, 'artwork', 'v11-desktop')

    assert.deepEqual(
      assets.filter((asset) => asset.includes('grow-v11-desktop-')),
      ['grow-v11-desktop-1500.webp']
    )
    assert.doesNotMatch(page, /desktopName=["']grow-v11-desktop["']/)
    assert.doesNotMatch(page, /desktopName=["']grow-v10-desktop["']/)
    assert.match(page, /name=["']grow-photoroom["']/)

    const builder = await readFile(
      path.join(siteRoot, 'scripts', 'build-v11-grow-desktop.py'),
      'utf8'
    )
    assert.match(builder, /grow-v04-1920\.webp/)
    assert.match(builder, /grow-master\.png/)
    for (const contract of [
      'extract_approved_source_pixels',
      'derive_connector_mask_from_reference',
      'deblock_source_pixels',
      'iterative_back_projection',
      'reconstruct_source_pixel_pyramid',
      'fit_source_pixels_to_v06_anchors',
      'measure_source_fidelity',
      'verify_source_texture_fidelity'
    ]) {
      assert.match(builder, new RegExp(`def ${contract}\\(`))
    }
    assert.doesNotMatch(
      builder,
      /ImageDraw|render_(?:gradient|profile|reference_layer)|hardcoded.*color/i
    )
    assert.doesNotMatch(builder, /imagegen|generated_images|grow-v05/i)

    const manifest = JSON.parse(
      await readFile(
        path.join(artworkRoot, 'grow-v11-source-fidelity.json'),
        'utf8'
      )
    )
    assert.equal(manifest.mode, 'source-pixel-pyramid')
    assert.equal(
      manifest.sourceAssetSha256,
      '490ea5da4235ce86a07aff7e2a7749710537ee3c87364b7a6482603388ae5761'
    )
    assert.ok(manifest.roundTripMeanAbsoluteError <= 4)
    assert.ok(manifest.edgeEnergyRatio >= 0.9)
    assert.ok(manifest.edgeEnergyRatio <= 1.35)
    assert.ok(manifest.textureEnergyRatio >= 0.85)
    assert.ok(manifest.textureEnergyRatio <= 1.4)
    assert.ok(manifest.sourcePixelCoverage >= 0.98)
    assert.ok(manifest.backgroundLeakRatio <= 0.01)
    assert.ok(manifest.outsideSupportAlphaRatio <= 0.01)
    assert.ok(manifest.chromaArtifactRatio <= 0.9)
    assert.ok(manifest.lumaArtifactRatio <= 0.95)
    assert.ok(manifest.highResolutionEdgeGain >= 1.4)
    assert.ok(manifest.highResolutionEdgeGain <= 2)
  }
)

localArtworkTest(
  'V12 previews the original mechanical connector style with one centered pipe and only the lower red reservoir',
  async () => {
    const page = await readAppFile('page.tsx')
    const artworkRoot = path.join(siteRoot, 'artwork', 'v12-desktop')
    const builder = await readFile(
      path.join(siteRoot, 'scripts', 'build-v12-grow-connector-preview.py'),
      'utf8'
    )

    assert.doesNotMatch(page, /desktopName=["']grow-v12-desktop["']/)
    assert.deepEqual(await listFiles(artworkRoot), [
      'grow-v12-red-connector-preview.png',
      'grow-v12-two-end-context-preview.png'
    ])
    assert.match(builder, /build-v10-grow-desktop\.py/)
    assert.match(builder, /LOWER_RESERVOIR_TOP\s*=\s*118/)
    assert.match(builder, /CENTER_PIPE_Y\s*=\s*117/)
    assert.match(builder, /LEFT_END_COLLAR_WIDTH\s*=\s*20/)
    assert.match(builder, /RIGHT_END_COLLAR_WIDTH\s*=\s*18/)
    assert.doesNotMatch(builder, /["']middle_clamp["']/)
    for (const contract of [
      'load_v10_renderer',
      'isolate_lower_reservoir',
      'render_one_center_pipe',
      'verify_end_collar_widths',
      'crop_red_connector_preview',
      'restore_context_background_band',
      'verify_context_background_continuity',
      'verify_context_background_neutrality',
      'build_two_end_context_preview',
      'verify_v12_preview'
    ]) {
      assert.match(builder, new RegExp(`def ${contract}\\(`))
    }
    assert.doesNotMatch(builder, /master\.paste\(blank_paper/)
  }
)

localArtworkTest(
  'V13 restores the exact reservoir and pipe widths and matches each joint to its attached module',
  async () => {
    const page = await readAppFile('page.tsx')
    const artworkRoot = path.join(siteRoot, 'artwork', 'v13-desktop')
    const builder = await readFile(
      path.join(siteRoot, 'scripts', 'build-v13-grow-connector-preview.py'),
      'utf8'
    )

    assert.doesNotMatch(page, /desktopName=["']grow-v13-desktop["']/)
    assert.deepEqual(await listFiles(artworkRoot), [
      'grow-v13-red-connector-preview.png',
      'grow-v13-two-end-context-preview.png'
    ])
    assert.match(builder, /build-v12-grow-connector-preview\.py/)
    assert.match(builder, /RESERVOIR_LEFT\s*=\s*49/)
    assert.match(builder, /RESERVOIR_RIGHT\s*=\s*344/)
    assert.match(builder, /V06_PIPE_RED_LEFT\s*=\s*936/)
    assert.match(builder, /V06_PIPE_RED_RIGHT\s*=\s*1140/)
    assert.match(builder, /PIPE_LEFT\s*=\s*53/)
    assert.match(builder, /PIPE_RIGHT\s*=\s*318/)
    assert.match(builder, /LEFT_JOINT_BOX\s*=\s*\(43,\s*101,\s*61,\s*225\)/)
    assert.match(builder, /RIGHT_JOINT_BOX\s*=\s*\(318,\s*101,\s*337,\s*226\)/)
    assert.match(builder, /LEFT_END_STYLE\s*=\s*["']right_clamp["']/)
    assert.match(builder, /RIGHT_END_STYLE\s*=\s*["']left_chrome_collar["']/)
    for (const contract of [
      'resize_pipe_to_two_pipe_width',
      'render_attachment_aware_collars',
      'verify_exact_source_widths',
      'verify_reservoir_pipe_proportions',
      'verify_attachment_materials'
    ]) {
      assert.match(builder, new RegExp(`def ${contract}\\(`))
    }
  }
)

localArtworkTest(
  'V14 rests directly on the red block at left and inserts through one ring into the white block at right',
  async () => {
    const page = await readAppFile('page.tsx')
    const artworkRoot = path.join(siteRoot, 'artwork', 'v14-desktop')
    const builder = await readFile(
      path.join(siteRoot, 'scripts', 'build-v14-grow-connector-preview.py'),
      'utf8'
    )

    assert.doesNotMatch(page, /desktopName=["']grow-v14-desktop["']/)
    assert.deepEqual(await listFiles(artworkRoot), [
      'grow-v14-red-connector-preview.png',
      'grow-v14-two-end-context-preview.png'
    ])
    assert.match(builder, /build-v13-grow-connector-preview\.py/)
    assert.match(
      builder,
      /LEFT_SUPPORT_MODE\s*=\s*["']rests_on_red_block_edge["']/
    )
    assert.match(
      builder,
      /RIGHT_SUPPORT_MODE\s*=\s*["']inserted_through_white_module_ring["']/
    )
    assert.match(builder, /RED_BLOCK_SUPPORT_EDGE\s*=\s*49/)
    assert.match(builder, /WHITE_MODULE_FACE_EDGE\s*=\s*337/)
    assert.match(
      builder,
      /RIGHT_INSERTION_RING_BOX\s*=\s*\(318,\s*101,\s*337,\s*226\)/
    )
    assert.doesNotMatch(builder, /LEFT_JOINT_BOX/)
    for (const contract of [
      'render_right_insertion_ring',
      'verify_left_edge_has_no_joint',
      'verify_right_insertion_depth',
      'verify_v14_support_model'
    ]) {
      assert.match(builder, new RegExp(`def ${contract}\\(`))
    }
  }
)

test('CTA interaction becomes brighter and the closing uses the transparent supplied domain-preservation concept', async () => {
  const page = await readAppFile('page.tsx')
  const css = await readAppFile('globals.css')

  assert.match(css, /--signal-red-hover:\s*#f[0-9a-f]{5}/i)
  assert.match(css, /\.button--red:hover\s*\{[^}]*var\(--signal-red-hover\)/s)
  assert.match(css, /\.button--red:focus-visible\s*\{/)
  assert.match(page, /name="closing-core-v09-photoroom"/)
  assert.doesNotMatch(page, /className="domain-names"/)
})

test('the responsive layout keeps balanced proof spacing without section rules', async () => {
  const css = await readAppFile('globals.css')
  const proofRule = css.match(/\.proof\s*\{([^}]+)\}/s)?.[1] ?? ''
  const baseRule = (selector) => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return css.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`, 's'))?.[1] ?? ''
  }

  assert.match(css, /--paper:\s*#[0-9a-f]{6}/i)
  assert.match(css, /--signal-red:\s*#[0-9a-f]{6}/i)
  assert.match(css, /--page-min-width:\s*320px/)
  assert.match(css, /--page-max-width:\s*2520px/)
  assert.match(css, /--page-padding-x:\s*clamp\(38px,\s*6\.25vw,\s*64px\)/)
  assert.match(css, /body\s*\{[^}]*min-width:\s*var\(--page-min-width\)/s)
  for (const selector of [
    '.site-header',
    '.hero',
    '.domains__heading',
    '.poc-story__inner',
    '.proof-stack',
    '.site-footer'
  ]) {
    const rule = baseRule(selector)
    assert.match(rule, /max-width:\s*var\(--page-max-width\)/, selector)
    assert.match(rule, /var\(--page-padding-x\)/, selector)
  }
  assert.match(
    baseRule('.closing'),
    /padding:\s*14px\s+var\(--page-content-inset-x\)/
  )
  assert.match(css, /@media\s*\(max-width:\s*1100px\)/)
  assert.match(css, /@media\s*\(max-width:\s*800px\)/)
  assert.match(css, /@media\s*\(max-width:\s*680px\)/)
  assert.doesNotMatch(css, /@media\s*\(max-width:\s*(?:700|760)px\)/)
  assert.match(css, /@media\s*\(max-width:\s*390px\)/)
  assert.doesNotMatch(css, /@media\s*\(max-width:\s*820px\)/)
  assert.match(css, /prefers-reduced-motion/)
  assert.match(proofRule, /min-height:\s*clamp\(220px,\s*25vw,\s*390px\)/)
  assert.match(
    baseRule('.proof-stack'),
    /padding-inline:\s*var\(--page-padding-x\)/
  )
  assert.match(
    css,
    /\.proof,\s*\.proof--visual-first\s*\{[^}]*padding-block:\s*clamp\(32px,\s*6vw,\s*44px\)/s
  )
  assert.doesNotMatch(css, /\.domain-rail\s*\{[^}]*width:\s*clamp\(/s)
  assert.doesNotMatch(proofRule, /border/)
  assert.doesNotMatch(css, /mix-blend-mode:\s*(?:darken|multiply)/)
})

test('every illustration uses the shared adaptive code grid and alpha-aware drop shadow', async () => {
  const page = await readAppFile('page.tsx')
  const css = await readAppFile('globals.css')
  const stages = page.match(/className="[^"]*\billustration-stage\b[^"]*"/g)
  const shadowProfiles = [
    'hero',
    'rail',
    'grow',
    'same-path',
    'one-source',
    'closing'
  ]

  assert.equal(stages?.length, 6)
  assert.match(css, /\.illustration-stage\s*\{/)
  assert.match(css, /\.illustration-stage::before\s*\{/)
  assert.match(css, /--grid-unit:\s*clamp\(/)
  assert.match(css, /repeating-linear-gradient\(/)
  assert.match(css, /radial-gradient\(/)
  assert.match(css, /mask-image:/)
  assert.match(
    css,
    /\.illustration-stage\s*>\s*img,\s*\.illustration-stage\s*>\s*picture\s*>\s*img\s*\{[^}]*drop-shadow\(/s
  )
  const castVectors = shadowProfiles.map((profile) => {
    assert.match(page, new RegExp(`illustration-stage--${profile}`))
    const rule =
      css.match(
        new RegExp(`\\.illustration-stage--${profile}\\s*\\{([^}]+)\\}`, 's')
      )?.[1] ?? ''
    const castX = rule.match(/--shadow-cast-x:\s*([^;]+);/)?.[1]
    const castY = rule.match(/--shadow-cast-y:\s*([^;]+);/)?.[1]

    assert.match(rule, /--shadow-contact-x:/)
    assert.match(rule, /--shadow-contact-y:/)
    assert.ok(castX, `${profile} must own a cast-shadow x vector`)
    assert.ok(castY, `${profile} must own a cast-shadow y vector`)
    return `${castX}|${castY}`
  })
  assert.equal(new Set(castVectors).size, shadowProfiles.length)
  assert.match(
    css,
    /\.illustration-stage--dark\s*\{[^}]*--shadow-ambient-color:\s*rgb\(0 130 215 \/ [^)]+\)/s
  )
  assert.doesNotMatch(
    css,
    /background-image:\s*url\(['"]\/illustrations\/closing-grid-/
  )
})

test('the typography uses a modern system sans stack without legacy display serifs', async () => {
  const css = await readAppFile('globals.css')

  assert.match(css, /--display:\s*system-ui,\s*-apple-system/i)
  assert.match(css, /--sans:\s*system-ui,\s*-apple-system/i)
  assert.doesNotMatch(css, /Baskerville|Iowan Old Style|Times New Roman/i)
  assert.doesNotMatch(css, /font-family:\s*var\(--serif\)/)

  const headingRules = [
    css.match(/\.hero h1\s*\{([^}]+)\}/s)?.[1] ?? '',
    css.match(/\.proof h2\s*\{([^}]+)\}/s)?.[1] ?? '',
    css.match(/\.closing h2\s*\{([^}]+)\}/s)?.[1] ?? ''
  ]
  for (const rule of headingRules) {
    const weight = Number(rule.match(/font-weight:\s*(\d+)/)?.[1])
    assert.ok(
      weight <= 500,
      `Display weight must stay at 500 or below: ${weight}`
    )
  }
  assert.doesNotMatch(css, /letter-spacing:\s*-(?:0\.0[6-9]|0\.[1-9])em/)
})
