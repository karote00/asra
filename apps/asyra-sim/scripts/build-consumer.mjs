import { spawn, execFileSync } from 'node:child_process'
import {
  createWriteStream,
  readFileSync,
  writeFileSync,
  mkdirSync,
  mkdtempSync,
  cpSync,
  readdirSync,
  rmSync
} from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import process from 'node:process'
import { setTimeout, clearTimeout } from 'node:timers'
import { fileURLToPath, URL } from 'node:url'
import { createReleasePackageArtifactPlan } from '../../../scripts/release-package-artifacts.js'
import { isolatedConsumerCommand } from './consumer-isolation.mjs'
import {
  consumerManifest,
  consumerBuildConfig,
  assertFrozenRegistryLock,
  assertOwnedPaths,
  assertInstalledPackages
} from './consumer-contract.mjs'

const repository = fileURLToPath(new URL('../../../', import.meta.url))
const appDirectory = path.join(repository, 'apps/asyra-sim')
const json = (filename) => JSON.parse(readFileSync(filename, 'utf8'))
const digest = (filename) =>
  createHash('sha256').update(readFileSync(filename)).digest('hex')
const git = (args) =>
  execFileSync('git', args, { cwd: repository, encoding: 'utf8' }).trim()

export async function buildConsumer() {
  if (process.versions.node.split('.')[0] !== '24')
    throw new Error('Node.js 24.x is required.')
  if (git(['status', '--porcelain']))
    throw new Error(
      'Commit or preserve pending work before building an exact-source candidate.'
    )
  const sourceCommit = git(['rev-parse', 'HEAD'])
  const artifactParent = path.join(appDirectory, '.artifacts/consumers')
  mkdirSync(artifactParent, { recursive: true })
  const output = mkdtempSync(
    path.join(artifactParent, `${sourceCommit.slice(0, 12)}-`)
  )
  const snapshot = path.join(output, 'tmp/source'),
    consumer = path.join(output, 'app')
  const logs = path.join(output, 'logs'),
    temporary = path.join(output, 'tmp')
  for (const directory of [
    snapshot,
    consumer,
    logs,
    temporary,
    path.join(output, 'framework')
  ])
    mkdirSync(directory, { recursive: true })
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) =>
        !key.startsWith('VITE_') &&
        !['APP_URL', 'NODE_PATH', 'NODE_OPTIONS'].includes(key)
    )
  )
  Object.assign(environment, {
    APP_URL: 'http://127.0.0.1:3020',
    CI: '1',
    YARN_ENABLE_GLOBAL_CACHE: 'false',
    YARN_CACHE_FOLDER: path.join(repository, '.yarn/cache'),
    YARN_GLOBAL_FOLDER: path.join(temporary, 'yarn-global'),
    YARN_ENABLE_NETWORK: '0',
    COREPACK_ENABLE_NETWORK: '0',
    TURBO_TELEMETRY_DISABLED: '1',
    DO_NOT_TRACK: '1',
    TMPDIR: temporary,
    TMP: temporary,
    TEMP: temporary,
    npm_config_cache: path.join(temporary, 'npm-cache'),
    npm_config_devdir: path.join(temporary, 'node-gyp')
  })
  let active,
    aborted = false
  const stop = () => {
    aborted = true
    if (active) {
      try {
        process.kill(-active.pid, 'SIGKILL')
      } catch {
        /* The owned process may already have exited. */
      }
    }
  }
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
  let number = 0
  async function run(label, command, args, cwd, isolate = false) {
    if (aborted) throw new Error('Build cancelled.')
    if (isolate)
      ({ command, args } = isolatedConsumerCommand(cwd, command, args))
    const filename = path.join(
      logs,
      `${String(++number).padStart(2, '0')}-${label}.log`
    )
    const stream = createWriteStream(filename, { flags: 'wx' })
    let bytes = 0,
      failure
    await new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd,
        env: environment,
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe']
      })
      active = child
      process.stdout.write(
        `${label}: PID ${child.pid}; log ${path.relative(repository, filename)}\n`
      )
      const expire = (message) => {
        failure = new Error(message)
        try {
          process.kill(-child.pid, 'SIGKILL')
        } catch {
          /* Already exited. */
        }
      }
      const timer = setTimeout(
        () => expire(`${label} exceeded its 5-minute limit.`),
        300_000
      )
      const receive = (chunk) => {
        bytes += chunk.length
        if (bytes > 8 * 1024 * 1024)
          expire(`${label} exceeded its 8 MiB log limit.`)
        else stream.write(chunk)
      }
      child.stdout.on('data', receive)
      child.stderr.on('data', receive)
      child.once('error', (error) => {
        failure = error
      })
      child.once('close', (code) => {
        clearTimeout(timer)
        active = undefined
        stream.end(() =>
          failure || code !== 0
            ? reject(
                failure ??
                  new Error(`${label} failed (${code}); see ${filename}`)
              )
            : resolve()
        )
      })
    })
    return filename
  }
  try {
    const versionLog = await run('toolchain', 'yarn', ['--version'], repository)
    const yarnVersion = readFileSync(versionLog, 'utf8').trim()
    if (yarnVersion !== '4.3.1')
      throw new Error(`Yarn 4.3.1 is required; found ${yarnVersion}.`)
    await run(
      'archive',
      'git',
      [
        'archive',
        '--format=tar',
        `--output=${path.join(output, 'source.tar')}`,
        sourceCommit
      ],
      repository
    )
    await run(
      'extract',
      'tar',
      ['-xf', path.join(output, 'source.tar'), '-C', snapshot],
      repository
    )
    await run('source-install', 'yarn', ['install', '--immutable'], snapshot)
    await run('build-graph', 'yarn', ['gen:turbo:check'], snapshot)
    const planned = createReleasePackageArtifactPlan({
      repositoryRoot: snapshot
    })
    const tasks = planned.map(
      (item) =>
        `${item.packageName}#build:${item.packageName.slice('@asyra/'.length)}`
    )
    await run(
      'framework-build',
      'yarn',
      ['exec', 'turbo', 'run', ...tasks, '--concurrency=2', '--force'],
      snapshot
    )
    await run(
      'framework-pack',
      process.execPath,
      ['scripts/release-package-artifacts.js', '--prebuilt'],
      snapshot
    )
    const packages = planned.map((item) => {
      const tarballPath = path.join(
        output,
        'framework',
        path.basename(item.tarballPath)
      )
      cpSync(item.tarballPath, tarballPath)
      return { ...item, tarballPath }
    })
    const sourceApp = path.join(snapshot, 'apps/asyra-sim')
    const app = json(path.join(sourceApp, 'package.json'))
    for (const entry of [
      'src',
      'samples',
      'e2e',
      'index.html',
      'tsconfig.json',
      'vite.config.ts',
      'vitest.config.ts',
      'playwright.config.ts',
      'app-environment.mjs',
      'app-environment.d.mts'
    ])
      cpSync(path.join(sourceApp, entry), path.join(consumer, entry), {
        recursive: true
      })
    cpSync(path.join(sourceApp, '.env.example'), path.join(consumer, '.env'))
    const manifest = consumerManifest(
      app,
      json(path.join(snapshot, 'package.json')),
      packages
    )
    writeFileSync(
      path.join(consumer, 'package.json'),
      JSON.stringify(manifest, null, 2) + '\n'
    )
    writeFileSync(
      path.join(consumer, '.yarnrc.yml'),
      'nodeLinker: node-modules\nenableGlobalCache: false\nenableTransparentWorkspaces: false\n'
    )
    cpSync(path.join(snapshot, 'yarn.lock'), path.join(consumer, 'yarn.lock'))
    writeFileSync(
      path.join(consumer, 'consumer.vite.config.mjs'),
      consumerBuildConfig
    )
    mkdirSync(path.join(consumer, '.build-evidence'))
    await run(
      'consumer-install',
      'yarn',
      ['install', '--no-immutable'],
      consumer
    )
    const registryPackages = assertFrozenRegistryLock(
      readFileSync(path.join(snapshot, 'yarn.lock'), 'utf8'),
      readFileSync(path.join(consumer, 'yarn.lock'), 'utf8')
    )
    assertInstalledPackages(consumer, packages)
    // Explicitly require every direct dependency; ancestor hoisting cannot satisfy it.
    assertOwnedPaths(
      consumer,
      Object.keys({
        ...manifest.dependencies,
        ...manifest.devDependencies
      }).map((name) =>
        path.join(consumer, 'node_modules', name, 'package.json')
      )
    )
    await run(
      'consumer-immutable',
      'yarn',
      ['install', '--immutable'],
      consumer
    )
    const typeFiles = await run(
      'type-boundary',
      'yarn',
      ['exec', 'tsc', '--noEmit', '--listFilesOnly'],
      consumer,
      true
    )
    assertOwnedPaths(
      consumer,
      readFileSync(typeFiles, 'utf8').trim().split('\n')
    )
    await run('consumer-tests', 'yarn', ['test:local'], consumer, true)
    await run('consumer-build', 'yarn', ['build'], consumer, true)
    const moduleEvidence = readdirSync(
      path.join(consumer, '.build-evidence')
    ).sort()
    if (moduleEvidence.length < 3)
      throw new Error(
        'Main and both module Worker build evidence are required.'
      )
    if (
      git(['rev-parse', 'HEAD']) !== sourceCommit ||
      git(['status', '--porcelain'])
    )
      throw new Error(
        'Source changed during consumer verification; no passing record was written.'
      )
    const report = {
      format: 'asyra-sim-clean-consumer',
      version: 1,
      status: 'independent-build-passed',
      sourceCommit,
      appVersion: app.version,
      node: process.version,
      yarn: yarnVersion,
      completedAt: new Date().toISOString(),
      registryPackages,
      lockSha256: digest(path.join(consumer, 'yarn.lock')),
      sourceArchiveSha256: digest(path.join(output, 'source.tar')),
      framework: packages.map((item) => ({
        name: item.packageName,
        version: item.version,
        file: `framework/${path.basename(item.tarballPath)}`,
        sha256: digest(item.tarballPath)
      })),
      moduleEvidence,
      remainingGates: [
        'packaged offline user journey',
        'dependency security and notices review',
        'representative resource benchmark',
        'reference hardware',
        'independent pilots',
        'maintenance policy'
      ]
    }
    writeFileSync(
      path.join(output, 'consumer-evidence.json'),
      JSON.stringify(report, null, 2) + '\n'
    )
    // Keep the exact consumer, tarballs, source archive and logs for artifact assembly/reproduction.
    rmSync(snapshot, { recursive: true })
    process.stdout.write(
      `Independent consumer passed: ${path.relative(repository, output)}\nNot an R0 release decision.\n`
    )
    return output
  } catch (error) {
    writeFileSync(
      path.join(output, 'failure.json'),
      JSON.stringify(
        { sourceCommit, status: 'failed', message: error.message },
        null,
        2
      ) + '\n'
    )
    throw error
  } finally {
    process.off('SIGINT', stop)
    process.off('SIGTERM', stop)
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  if (process.argv.length > 2)
    throw new Error(
      'This command accepts no options; it always verifies the exact clean source.'
    )
  await buildConsumer()
}
