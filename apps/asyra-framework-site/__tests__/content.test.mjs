import assert from 'node:assert/strict'
import test from 'node:test'
import {
  loadContentBundle,
  pageForSlug,
  resolveContentHref,
  validatePageRecord
} from '../lib/content.mjs'

test('content adapter verifies the complete release candidate inventory', () => {
  const bundle = loadContentBundle()
  assert.equal(bundle.pages.length, 41)
  assert.equal(bundle.pageById.size, 41)
  assert.equal(bundle.pageByPath.size, 41)
  assert.equal(bundle.packages.length, 19)
  assert.equal('examples' in bundle, false)
  assert.equal('runtime' in bundle, false)
  assert.deepEqual(bundle.release, {
    family: '0.5',
    packageCount: 19,
    publicationAuthorized: false,
    status: 'CANDIDATE'
  })
  assert.equal(
    bundle.repositoryHref.endsWith(`/${bundle.repositoryName}`),
    true
  )
})

test('every page has one stable route, digest, heading set, and search record', () => {
  const bundle = loadContentBundle()
  const routes = new Set(bundle.pages.map(({ route }) => route))
  assert.equal(routes.size, 41)
  bundle.pages.forEach((page) => {
    assert.match(page.digest, /^[a-f0-9]{64}$/)
    assert.ok(page.headings.length > 0, page.id)
    assert.ok(
      bundle.searchRecords.some(({ id }) => id === page.id),
      page.id
    )
    assert.equal(pageForSlug(bundle, page.slug), page)
  })
})

test('public Markdown links resolve to website routes and canonical source evidence', () => {
  const bundle = loadContentBundle()
  const overview = bundle.pageById.get('overview')
  assert.equal(
    resolveContentHref({
      bundle,
      page: overview,
      href: 'start/create-design-app.md'
    }),
    '/docs/start/create-design-app'
  )
  assert.equal(
    resolveContentHref({ bundle, page: overview, href: '#current-support' }),
    '#current-support'
  )
  const canonicalSource = resolveContentHref({
    bundle,
    page: overview,
    href: '../ai/framework/ARCHITECTURE.md'
  })
  assert.equal(
    canonicalSource.startsWith(`${bundle.repositoryHref}/blob/`),
    true
  )
  assert.match(
    canonicalSource,
    /\/(?:main|[a-f0-9]+)\/docs\/ai\/framework\/ARCHITECTURE\.md$/
  )
})

test('content adapter rejects page digest and heading drift', () => {
  const bundle = loadContentBundle()
  const page = bundle.pages[0]
  assert.throws(
    () =>
      validatePageRecord({
        manifestPage: page,
        indexPage: {
          ...page,
          contentSha256: page.digest,
          headings: page.headings.map(({ depth, title }) => ({ depth, title }))
        },
        sourceMapPage: { pageSha256: page.digest },
        markdown: `${page.markdown}\nchanged`
      }),
    /Public content digest drift/
  )
  assert.throws(
    () =>
      validatePageRecord({
        manifestPage: page,
        indexPage: {
          ...page,
          contentSha256: page.digest,
          headings: []
        },
        sourceMapPage: { pageSha256: page.digest },
        markdown: page.markdown
      }),
    /Public content heading drift/
  )
})
