import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { builtinModules } from 'node:module'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

const testDirectory = path.dirname(fileURLToPath(import.meta.url))
const appDirectory = path.resolve(testDirectory, '..')
const sourceDirectory = path.join(appDirectory, 'src')
const serverDirectory = path.join(appDirectory, 'server')
const packageJson = JSON.parse(
  readFileSync(path.join(appDirectory, 'package.json'), 'utf8')
)

const sourceFiles = []
const visit = (directory, files = sourceFiles) => {
  for (const entry of readdirSync(directory)) {
    const absolutePath = path.join(directory, entry)
    if (statSync(absolutePath).isDirectory()) {
      if (entry !== '__tests__') visit(absolutePath, files)
      continue
    }
    if (/\.(?:ts|tsx|mjs)$/.test(entry)) files.push(absolutePath)
  }
}
visit(sourceDirectory)
const backendSourceFiles = []
visit(serverDirectory, backendSourceFiles)
backendSourceFiles.push(path.join(appDirectory, 'collaboration-server.ts'))

const runtimePackagesOwnedByCore = [
  'factory',
  'feature-system',
  'input-system',
  'reactive-events',
  'render'
]

const nodeBuiltins = new Set([
  ...builtinModules,
  ...builtinModules.map((moduleName) => `node:${moduleName}`)
])
const externalPackageName = (specifier) =>
  specifier.startsWith('@')
    ? specifier.split('/').slice(0, 2).join('/')
    : specifier.split('/')[0]
const collectExternalImports = (absolutePath) => {
  const source = readFileSync(absolutePath, 'utf8')
  const imports = new Set()
  const pattern =
    /(?:import|export)\s+(?:[^'";]*?\s+from\s*)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/gu

  for (const match of source.matchAll(pattern)) {
    const specifier = match[1] ?? match[2] ?? match[3]
    if (
      specifier.startsWith('.') ||
      specifier.startsWith('/') ||
      nodeBuiltins.has(specifier)
    ) {
      continue
    }
    imports.add(externalPackageName(specifier))
  }
  return imports
}

test('Asyra Design production code uses Core for framework-owned runtime capabilities', () => {
  const failures = []
  for (const absolutePath of sourceFiles) {
    const source = readFileSync(absolutePath, 'utf8')
    if (/\bcore\.deps\b/.test(source)) {
      failures.push(
        `${path.relative(appDirectory, absolutePath)} accesses core.deps`
      )
    }
    for (const packageName of runtimePackagesOwnedByCore) {
      if (
        new RegExp(`['"]@asyra/${packageName.replaceAll('-', '\\-')}['"]`).test(
          source
        )
      ) {
        failures.push(
          `${path.relative(appDirectory, absolutePath)} imports @asyra/${packageName}`
        )
      }
    }
  }
  assert.deepEqual(failures, [])
})

test('Asyra Design declares only independently composed framework packages', () => {
  for (const packageName of runtimePackagesOwnedByCore) {
    assert.equal(
      packageJson.dependencies[`@asyra/${packageName}`],
      undefined,
      `@asyra/${packageName} must be consumed through @asyra/core`
    )
  }
  assert.equal(typeof packageJson.dependencies['@asyra/core'], 'string')
  assert.equal(
    typeof packageJson.dependencies['@asyra/collaboration'],
    'string',
    'Provider and wire adapters remain independently composed'
  )
  assert.equal(packageJson.scripts.start, 'vite dev')
  assert.equal(packageJson.scripts['react:start'], undefined)
})

test('Asyra Design declares every production import as a direct runtime dependency', () => {
  const missingDependencies = new Map()
  for (const absolutePath of [...sourceFiles, ...backendSourceFiles]) {
    for (const packageName of collectExternalImports(absolutePath)) {
      if (packageJson.dependencies[packageName] !== undefined) continue
      const consumers = missingDependencies.get(packageName) ?? []
      consumers.push(path.relative(appDirectory, absolutePath))
      missingDependencies.set(packageName, consumers)
    }
  }

  assert.deepEqual(
    Object.fromEntries(
      [...missingDependencies]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([packageName, consumers]) => [
          packageName,
          [...new Set(consumers)].sort()
        ])
    ),
    {},
    'production imports must not rely on a hoisted or transitive dependency'
  )
})

test('Asyra Design declares the browser-like test environment used by Vitest', () => {
  assert.match(packageJson.scripts['test:ai'], /--environment jsdom/)
  assert.match(packageJson.scripts['test:local'], /--environment jsdom/)
  assert.equal(packageJson.devDependencies.jsdom, '16.7.0')
  assert.equal(
    packageJson.dependencies['@testing-library/dom'],
    '^8.20.1',
    '@testing-library/user-event must not rely on a transitive DOM test peer'
  )
})

test('Asyra Design backend depends only on App-owned protocols', () => {
  const failures = []
  for (const absolutePath of backendSourceFiles) {
    const source = readFileSync(absolutePath, 'utf8')
    if (/from\s+['"]@asyra\//.test(source)) {
      failures.push(
        `${path.relative(appDirectory, absolutePath)} imports an @asyra package`
      )
    }
  }
  assert.deepEqual(failures, [])
})

for (const configFileName of [
  'vite.collaboration-server.config.ts',
  'vite.document-backend.config.ts'
]) {
  test(`${configFileName} excludes framework modules from the backend graph`, async () => {
    const result = await build({
      root: appDirectory,
      configFile: path.join(appDirectory, configFileName),
      logLevel: 'silent',
      build: {
        emptyOutDir: false,
        write: false
      }
    })
    const buildResults = Array.isArray(result) ? result : [result]
    const chunks = buildResults
      .flatMap((buildResult) => buildResult.output)
      .filter((output) => output.type === 'chunk')
    const moduleIds = chunks.flatMap((chunk) => Object.keys(chunk.modules))
    const frameworkModules = moduleIds
      .filter(
        (moduleId) =>
          /[/\\]packages[/\\][^/\\]+[/\\](?:src|dist)[/\\]/.test(moduleId) ||
          /[/\\]node_modules[/\\]@asyra[/\\]/.test(moduleId)
      )
      .map((moduleId) => path.relative(appDirectory, moduleId))
    assert.deepEqual(frameworkModules, [])

    const frameworkTerms = chunks.flatMap((chunk) =>
      ['@asyra/', 'Factory', 'Core'].filter((term) => chunk.code.includes(term))
    )
    assert.deepEqual(
      frameworkTerms,
      [],
      'backend bundles must not expose framework package or runtime terminology'
    )
  })
}
