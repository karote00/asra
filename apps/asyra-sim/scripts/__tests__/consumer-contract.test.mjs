import assert from 'node:assert/strict'
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
  symlinkSync,
  readFileSync
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL, URL } from 'node:url'
import process from 'node:process'
import test from 'node:test'
import { buildConsumer } from '../build-consumer.mjs'
import {
  consumerManifest,
  assertFrozenRegistryLock,
  assertInstalledPackages,
  assertOwnedPaths,
  consumerBuildConfig
} from '../consumer-contract.mjs'

const app = {
  name: '@asyra/asyra-sim',
  version: '0.1.0-alpha.0',
  engines: { node: '24.x' },
  packageManager: 'yarn@4.3.1',
  license: 'MIT',
  dependencies: { '@asyra/core': 'workspace:*', react: '^19.2.8' },
  devDependencies: { typescript: '^5.7.2' }
}
const packages = [
  {
    packageName: '@asyra/core',
    version: '0.5.1',
    tarballPath: '/build/core.tgz'
  }
]
const lock = (version = '19.2.8', checksum = '10c0/abcd') =>
  `"react@npm:^19.2.8":\n  version: ${version}\n  resolution: "react@npm:${version}"\n  checksum: ${checksum}\n`

test('the independent consumer uses only packed Framework inputs and preserves approved registry declarations and overrides', () => {
  const manifest = consumerManifest(
    app,
    { resolutions: { react: '^19.2.8' } },
    packages
  )
  assert.equal(
    manifest.dependencies['@asyra/core'],
    'file:../framework/core.tgz'
  )
  assert.equal(
    manifest.resolutions['@asyra/core'],
    'file:../framework/core.tgz'
  )
  assert.equal(manifest.resolutions.react, '^19.2.8')
  assert.equal(manifest.devDependencies.typescript, '^5.7.2')
  assert.equal(app.dependencies['@asyra/core'], 'workspace:*')
  assert.doesNotMatch(JSON.stringify(manifest.scripts), /\.\.\/|workspace/)
  assert.throws(() => consumerManifest(app, {}, []), /Missing packed/)
  assert.throws(
    () =>
      consumerManifest(
        { ...app, dependencies: { react: 'link:../../node_modules/react' } },
        {},
        packages
      ),
    /Unsupported/
  )
  assert.throws(
    () => consumerManifest({ ...app, engines: { node: '22.x' } }, {}, packages),
    /toolchain/
  )
})

test('consumer lock evidence rejects upgrades, checksum drift and workspace or private resolution', () => {
  assert.equal(assertFrozenRegistryLock(lock(), lock()), 1)
  assert.throws(() => assertFrozenRegistryLock(lock(), lock('19.2.9')), /drift/)
  assert.throws(
    () => assertFrozenRegistryLock(lock(), lock('19.2.8', 'changed')),
    /drift/
  )
  for (const protocol of ['workspace', 'link', 'portal', 'patch'])
    assert.throws(
      () =>
        assertFrozenRegistryLock(
          lock(),
          `${lock()}\n  resolution: "private@${protocol}:../repo"\n`
        ),
      /private source/
    )
  assert.equal(
    assertFrozenRegistryLock(
      lock(),
      `${lock()}\n  resolution: "@asyra/asyra-sim@workspace:."\n`
    ),
    1
  )
  assert.throws(() => assertFrozenRegistryLock(lock(), ''), /no registry/)
})

test('type and installed-package evidence cannot use ancestor hoisting or symbolic links outside the consumer', (t) => {
  const parent = fileURLToPath(
    new URL('../../.artifacts/consumer-tests/', import.meta.url)
  )
  mkdirSync(parent, { recursive: true })
  const directory = mkdtempSync(path.join(parent, 'case-'))
  t.after(() => rmSync(directory, { recursive: true }))
  const root = path.join(directory, 'consumer'),
    outside = path.join(directory, 'outside.json')
  const pkg = path.join(root, 'node_modules/@asyra/core')
  mkdirSync(pkg, { recursive: true })
  writeFileSync(outside, '{}')
  const manifestPath = path.join(pkg, 'package.json')
  writeFileSync(
    manifestPath,
    JSON.stringify({ name: '@asyra/core', version: '0.5.1' })
  )
  assertOwnedPaths(root, [manifestPath])
  assertInstalledPackages(root, packages)
  assert.throws(() => assertOwnedPaths(root, [outside]), /escaped/)
  assert.throws(
    () => assertInstalledPackages(root, [{ ...packages[0], version: '0.5.2' }]),
    /identity/
  )
  const linked = path.join(root, 'linked.json')
  symlinkSync(outside, linked)
  assert.throws(() => assertOwnedPaths(root, [linked]), /escaped/)
})

test('the generator is importable without creating a consumer or starting child commands', () => {
  assert.equal(typeof buildConsumer, 'function')
})

test('main and Worker build plugins reject escaping real paths and retain only owned module evidence', async (t) => {
  const parent = fileURLToPath(
    new URL('../../.artifacts/consumer-tests/', import.meta.url)
  )
  mkdirSync(parent, { recursive: true })
  const directory = mkdtempSync(path.join(parent, 'plugins-'))
  t.after(() => rmSync(directory, { recursive: true }))
  const root = path.join(directory, 'consumer')
  mkdirSync(path.join(root, '.build-evidence'), { recursive: true })
  const outside = path.join(directory, 'outside.js'),
    inside = path.join(root, 'inside.js')
  writeFileSync(outside, 'export const value = 1')
  writeFileSync(inside, 'export const value = 2')
  symlinkSync(outside, path.join(root, 'linked.js'))
  writeFileSync(
    path.join(root, 'vite.config.ts'),
    'export default { plugins: [], worker: {} }'
  )
  writeFileSync(
    path.join(root, 'consumer.vite.config.mjs'),
    consumerBuildConfig
  )
  const previous = process.cwd()
  try {
    process.chdir(root)
    const { default: configuration } = await import(
      pathToFileURL(path.join(root, 'consumer.vite.config.mjs')).href
    )
    for (const plugin of [
      configuration.plugins[0],
      ...configuration.worker.plugins()
    ]) {
      plugin.moduleParsed({ id: inside })
      plugin.moduleParsed({ id: '\0virtual' })
      assert.throws(() => plugin.moduleParsed({ id: outside }), /escaped/)
      assert.throws(
        () => plugin.moduleParsed({ id: path.join(root, 'linked.js') }),
        /escaped/
      )
      plugin.generateBundle({}, { 'assets/entry.js': {} })
      assert.deepEqual(
        JSON.parse(
          readFileSync(
            path.join(root, '.build-evidence/assets_entry.js.json'),
            'utf8'
          )
        ),
        ['inside.js']
      )
    }
  } finally {
    process.chdir(previous)
  }
})
