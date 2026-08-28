import assert from 'node:assert/strict'
import test from 'node:test'
import {
  loadVerifiedPublicContent,
  publicPageHref,
  resolvePublicContentPath
} from '../lib/content.mjs'

test('the public content adapter verifies the complete generated inventory', async () => {
  const content = await loadVerifiedPublicContent()

  assert.equal(content.pages.length, 41)
  assert.equal(content.packages.length, 19)
  assert.deepEqual(
    [...content.sections.keys()],
    ['Overview', 'Start', 'Concepts', 'Extend', 'Customize', 'Reference']
  )
  assert.deepEqual(
    content.sections.get('Start').map(({ id }) => id),
    ['start/create-design-app', 'start/preset-2d', 'cases/asyra-design']
  )
  assert.deepEqual(
    content.sections.get('Concepts').map(({ id }) => id),
    [
      'learn/information-models',
      'learn/intent-and-features',
      'learn/canonical-state',
      'learn/transactions-and-durability',
      'learn/validation-load-migration',
      'learn/projection-registration-replacement',
      'learn/runtime-boundaries-roadmap'
    ]
  )
  assert.deepEqual(
    content.sections.get('Extend').map(({ id }) => id),
    [
      'start/extend-with-ai',
      'build/custom-schema',
      'build/feature-session',
      'build/hierarchy-groups',
      'build/persistence-migration',
      'build/collaboration',
      'build/ai-actions',
      'build/app-retrieval-action'
    ]
  )
  assert.deepEqual(
    content.sections.get('Customize').map(({ id }) => id),
    ['start/custom-composition', 'build/render-boundary']
  )
  assert.equal(new Set(content.pages.map(({ id }) => id)).size, 41)
  assert.equal(new Set(content.pages.map(({ href }) => href)).size, 41)
  assert.equal(
    content.pages.every(({ markdown }) => markdown.length > 80),
    true
  )
  assert.equal(
    content.pages.every(
      ({ contentSha256, verifiedSha256 }) => contentSha256 === verifiedSha256
    ),
    true
  )
})

test('documentation routes are stable and overview owns the docs root', () => {
  assert.equal(publicPageHref('overview'), '/docs')
  assert.equal(
    publicPageHref('learn/canonical-state'),
    '/docs/learn/canonical-state'
  )
})

test('content paths cannot leave the approved public bundle', () => {
  assert.throws(
    () => resolvePublicContentPath('../ai/framework/ARCHITECTURE.md'),
    /outside docs\/public/
  )
  assert.throws(
    () => resolvePublicContentPath('/tmp/content.md'),
    /relative path/
  )
})
