import {
  mkdirSync,
  mkdtempSync,
  cpSync,
  readFileSync,
  writeFileSync
} from 'node:fs'
import path from 'node:path'
import { distributionFiles, checksumText } from './distribution-files.mjs'
import { verifyDistribution } from './verify-files.mjs'
import { bundledNotices } from './distribution-notices.mjs'
import { rewriteDistributionMarkdown } from './distribution-docs.mjs'

const copyTree = (source, target) => {
  for (const file of distributionFiles(source)) {
    const destination = path.join(target, file)
    mkdirSync(path.dirname(destination), { recursive: true })
    cpSync(path.join(source, file), destination, {
      errorOnExist: true,
      force: false
    })
  }
}

/** Internal producer stage: call only after this invocation's consumer gates pass. */
export function assembleDistribution({ snapshot, consumer, output, report }) {
  if (
    report.status !== 'independent-build-passed' ||
    !/^[a-f0-9]{40}$/.test(report.sourceCommit) ||
    !/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(report.appVersion)
  )
    throw new Error('Assembly requires passing exact-source consumer evidence.')
  const sourceApp = path.join(snapshot, 'apps/asyra-sim')
  const staging = mkdtempSync(path.join(output, 'tmp/distribution-'))
  const productSlug = 'asyra-sim'
  const destination = path.join(
    staging,
    `${productSlug}-${report.appVersion}-${report.sourceCommit.slice(0, 12)}`
  )
  mkdirSync(destination)
  copyTree(path.join(consumer, 'dist'), path.join(destination, 'site'))
  const copy = (source, target) => {
    const filename = path.join(destination, target)
    mkdirSync(path.dirname(filename), { recursive: true })
    cpSync(source, filename, { errorOnExist: true, force: false })
  }
  for (const [source, target] of [
    ['local-server.mjs', 'server.mjs'],
    ['verify-files.mjs', 'verify-files.mjs'],
    ['distribution-files.mjs', 'distribution-files.mjs']
  ])
    copy(path.join(sourceApp, 'scripts', source), target)
  copy(path.join(snapshot, 'LICENSE'), 'LICENSE')

  const sdk = path.join(destination, 'sdk/app')
  for (const folder of ['src', 'samples', 'e2e'])
    copyTree(path.join(consumer, folder), path.join(sdk, folder))
  for (const file of [
    'package.json',
    'yarn.lock',
    '.yarnrc.yml',
    '.env',
    'index.html',
    'tsconfig.json',
    'vite.config.ts',
    'vitest.config.ts',
    'playwright.config.ts',
    'app-environment.mjs',
    'app-environment.d.mts',
    'consumer.vite.config.mjs'
  ])
    copy(path.join(consumer, file), `sdk/app/${file}`)
  copy(
    path.join(sourceApp, 'scripts/run-e2e.mjs'),
    'sdk/app/scripts/run-e2e.mjs'
  )
  mkdirSync(path.join(sdk, '.build-evidence'), { recursive: true })
  writeFileSync(path.join(sdk, '.build-evidence/.keep'), '')
  copyTree(
    path.join(output, 'framework'),
    path.join(destination, 'sdk/framework')
  )

  const docsRoot = 'docs/ai/apps/asyra-sim'
  const targets = new Map(
    distributionFiles(path.join(snapshot, docsRoot)).map((file) => [
      `${docsRoot}/${file}`,
      `docs/${file}`
    ])
  )
  targets.set('apps/asyra-sim/README.md', 'USER_GUIDE.md')
  targets.set(`${docsRoot}/release/LOCAL_CANDIDATE.md`, 'README.md')
  for (const [source, target] of targets) {
    const filename = path.join(snapshot, source)
    if (!source.endsWith('.md')) copy(filename, target)
    else {
      const text = rewriteDistributionMarkdown(
        readFileSync(filename, 'utf8'),
        source,
        targets,
        snapshot,
        report.sourceCommit
      )
      const filenameOut = path.join(destination, target)
      mkdirSync(path.dirname(filenameOut), { recursive: true })
      writeFileSync(filenameOut, text, { flag: 'wx' })
    }
  }

  const dependencies = bundledNotices(
    consumer,
    path.join(sourceApp, 'scripts/notices')
  )
  writeFileSync(
    path.join(destination, 'DEPENDENCIES.json'),
    JSON.stringify(
      dependencies.map(({ notices, ...record }) => ({
        ...record,
        notices: notices.map(({ name, source, sha256 }) => ({
          name,
          source,
          sha256
        }))
      })),
      null,
      2
    ) + '\n'
  )
  writeFileSync(
    path.join(destination, 'THIRD_PARTY_NOTICES.txt'),
    dependencies
      .map(
        (record) =>
          `${record.name}@${record.version} — ${record.license}\n\n${record.notices.map((notice) => `Source: ${notice.source}\n${notice.text}`).join('\n')}\n`
      )
      .join('\n')
  )
  writeFileSync(
    path.join(destination, 'BUILD.json'),
    JSON.stringify(
      {
        ...report,
        artifactKind: 'local-developer-candidate',
        bundledDependencyCount: dependencies.length
      },
      null,
      2
    ) + '\n'
  )
  writeFileSync(path.join(destination, 'SHA256SUMS'), checksumText(destination))
  verifyDistribution(destination)
  return destination
}
