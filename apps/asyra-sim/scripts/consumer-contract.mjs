import { realpathSync, readFileSync } from 'node:fs'
import path from 'node:path'

export function consumerManifest(app, root, packages) {
  if (app.engines?.node !== '24.x' || app.packageManager !== 'yarn@4.3.1')
    throw new Error(
      'The consumer requires the declared Node 24 / Yarn 4.3.1 toolchain.'
    )
  const packed = new Map(packages.map((item) => [item.packageName, item]))
  const convert = (dependencies = {}) =>
    Object.fromEntries(
      Object.entries(dependencies).map(([name, version]) => {
        if (name.startsWith('@asyra/')) {
          const item = packed.get(name)
          if (!item) throw new Error(`Missing packed dependency: ${name}`)
          return [name, `file:../framework/${path.basename(item.tarballPath)}`]
        }
        if (/workspace:|file:|link:|portal:|patch:/.test(version))
          throw new Error(`Unsupported external dependency source: ${name}`)
        return [name, version]
      })
    )
  return {
    name: app.name,
    version: app.version,
    private: true,
    type: 'module',
    license: app.license,
    engines: app.engines,
    packageManager: app.packageManager,
    scripts: {
      typecheck: 'tsc --noEmit',
      build: 'tsc --noEmit && vite build --config consumer.vite.config.mjs',
      'test:local': 'vitest run',
      dev: 'vite'
    },
    dependencies: convert(app.dependencies),
    devDependencies: convert(app.devDependencies),
    resolutions: {
      ...root.resolutions,
      ...Object.fromEntries(
        packages.map((item) => [
          item.packageName,
          `file:../framework/${path.basename(item.tarballPath)}`
        ])
      )
    }
  }
}

function registryRecords(lockfile) {
  const result = new Map()
  for (const block of lockfile.split('\n\n')) {
    const resolution = block.match(
      /^ {2}resolution: "([^"]+@npm:[^"]+)"$/m
    )?.[1]
    if (resolution)
      result.set(resolution, block.match(/^ {2}checksum: (.+)$/m)?.[1] ?? null)
  }
  return result
}

/** The isolated lock may drop unrelated workspaces, never select new registry inputs. */
export function assertFrozenRegistryLock(source, consumer) {
  const original = registryRecords(source),
    actual = registryRecords(consumer)
  if (!actual.size)
    throw new Error('The consumer has no registry dependency evidence.')
  for (const [identity, checksum] of actual) {
    if (!original.has(identity) || original.get(identity) !== checksum)
      throw new Error(`Registry dependency or integrity drift: ${identity}`)
  }
  if (
    /resolution: "[^"\n]+@(?:workspace|link|portal|patch):/.test(
      consumer.replace(/resolution: "@asyra\/asyra-sim@workspace:\."/, '')
    )
  )
    throw new Error(
      'The consumer resolves another workspace or private source.'
    )
  return actual.size
}

export function assertOwnedPaths(directory, filenames) {
  const root = realpathSync(directory)
  for (const filename of filenames) {
    const absolute = realpathSync(filename)
    const relative = path.relative(root, absolute)
    if (
      !relative ||
      relative.startsWith(`..${path.sep}`) ||
      relative === '..' ||
      path.isAbsolute(relative)
    )
      throw new Error(
        `Consumer dependency escaped its own directory: ${filename}`
      )
  }
}

export function assertInstalledPackages(directory, packages) {
  for (const item of packages) {
    const filename = path.join(
      directory,
      'node_modules',
      item.packageName,
      'package.json'
    )
    // Only packages reachable by the consumer must be installed.
    try {
      readFileSync(filename)
    } catch (error) {
      if (error.code === 'ENOENT') continue
      throw error
    }
    assertOwnedPaths(directory, [filename])
    const manifest = JSON.parse(readFileSync(filename, 'utf8'))
    if (manifest.name !== item.packageName || manifest.version !== item.version)
      throw new Error(
        `Installed package identity mismatch: ${item.packageName}`
      )
  }
}

export const consumerBuildConfig = `import { defineConfig } from 'vite'
import base from './vite.config.ts'
import { realpathSync, writeFileSync } from 'node:fs'
import path from 'node:path'
function fence() {
  const root = realpathSync(process.cwd())
  const files = new Set()
  return {
    name: 'asyra-sim-consumer-boundary',
    moduleParsed({ id }) {
      if (id.startsWith('\\0') || !path.isAbsolute(id)) return
      const filename = realpathSync(id.split('?')[0])
      if (!filename.startsWith(root + path.sep)) throw new Error('Build escaped consumer: ' + filename)
      files.add(path.relative(root, filename))
    },
    generateBundle(_, bundle) {
      const entry = Object.keys(bundle).sort()[0] ?? 'empty'
      const name = entry.replace(/[^a-zA-Z0-9.-]/g, '_')
      writeFileSync(path.join(root, '.build-evidence', name + '.json'), JSON.stringify([...files].sort()))
    }
  }
}
export default defineConfig({ ...base, plugins: [...base.plugins, fence()], worker: { ...base.worker, plugins: () => [fence()] } })
`
