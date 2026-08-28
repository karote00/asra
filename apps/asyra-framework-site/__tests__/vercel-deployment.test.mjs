import assert from 'node:assert/strict'
import test from 'node:test'

import {
  isFrameworkSiteBuildInput,
  shouldBuildFrameworkSite
} from '../scripts/vercel-ignore-build.mjs'

test('Framework site deployment follows every artifact input owner', () => {
  for (const file of [
    'apps/asyra-framework-site/app/page.tsx',
    'apps/asyra-framework-site/public/illustrations/hero.webp',
    'docs/public/generated/package-reference.json',
    'packages/core/src/core.ts',
    'packages/core/package.json',
    '.yarn/releases/yarn-4.3.1.cjs',
    '.yarnrc.yml',
    'package.json',
    'turbo.json',
    'yarn.lock'
  ]) {
    assert.equal(isFrameworkSiteBuildInput(file), true, file)
  }
})

test('Framework site deployment ignores changes outside its artifact graph', () => {
  for (const file of [
    '.github/workflows/e2e.yml',
    'apps/asyra-design/src/app/index.tsx',
    'docs/ai/framework/PLANS.md',
    'scripts/release-full.js'
  ]) {
    assert.equal(isFrameworkSiteBuildInput(file), false, file)
  }
})

test('one relevant file is sufficient to deploy an otherwise unrelated commit', () => {
  assert.equal(
    shouldBuildFrameworkSite([
      'docs/ai/framework/PLANS.md',
      'docs/public/reference/support-release.md'
    ]),
    true
  )
  assert.equal(
    shouldBuildFrameworkSite([
      'docs/ai/framework/PLANS.md',
      'scripts/release-full.js'
    ]),
    false
  )
})
