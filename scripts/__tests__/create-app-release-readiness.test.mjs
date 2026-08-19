import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  createCreateAppConsumerPlan,
  inspectCreateAppReleaseSource,
  resolveCreateAppReleasePath
} from '../create-app-release-readiness.js'

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
)

test('create-asyra-app release paths stay inside one project tmp child', () => {
  assert.equal(
    resolveCreateAppReleasePath({
      repositoryRoot,
      target: 'tmp/minimal-create-app-release',
      label: 'consumer'
    }),
    path.join(repositoryRoot, 'tmp/minimal-create-app-release')
  )
  assert.throws(
    () =>
      resolveCreateAppReleasePath({
        repositoryRoot,
        target: 'create-app/reference',
        label: 'consumer'
      }),
    /direct child of project tmp/u
  )
})

test('create-asyra-app owns a minimal versioned single-page source', () => {
  const source = inspectCreateAppReleaseSource({ repositoryRoot })

  assert.equal(source.name, 'create-asyra-app')
  assert.equal(source.version, '0.1.0')
  assert.deepEqual(source.bin, { 'create-asyra': './bin/index.js' })
  assert.deepEqual(source.publishedRoots, ['bin', 'template'])
  assert.deepEqual(source.runtimeDependencies, ['inquirer'])
  assert.deepEqual(source.templateDependencies, ['react', 'react-dom'])
  assert.deepEqual(source.templateSourceFiles, [
    'App.tsx',
    'framework-logo.svg',
    'main.tsx',
    'styles.css',
    'vite-env.d.ts'
  ])
})

test('all package managers prove the same packed clean-consumer gates', () => {
  const plan = createCreateAppConsumerPlan({ repositoryRoot })

  assert.deepEqual(
    plan.map(({ packageManager }) => packageManager),
    ['yarn', 'npm', 'pnpm']
  )
  assert.equal(
    plan.every(
      ({ generatedCommands }) =>
        generatedCommands.map(({ script }) => script).join(',') ===
        'test,typecheck,react:build'
    ),
    true
  )
  assert.equal(
    plan.every(({ projectName }) => projectName === 'generated-app'),
    true
  )
})

test('registry verification installs the fixed CLI version', () => {
  const plan = createCreateAppConsumerPlan({
    repositoryRoot,
    mode: 'registry',
    selectedPackageManagers: ['npm']
  })

  assert.equal(plan[0].packageSpecifier, 'create-asyra-app@0.1.0')
  assert.deepEqual(plan[0].installCommand, [
    'npm',
    ['install', '--save-dev', 'create-asyra-app@0.1.0']
  ])
})
