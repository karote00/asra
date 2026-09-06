import assert from 'node:assert/strict'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import test from 'node:test'
import {
  checksumText,
  distributionFiles,
  sha256
} from '../distribution-files.mjs'
import { verifyDistribution } from '../verify-files.mjs'
import { bundledNotices } from '../distribution-notices.mjs'
import { rewriteDistributionMarkdown } from '../distribution-docs.mjs'
import { assembleDistribution } from '../assemble-distribution.mjs'

test('all current App documentation links and supplemental notice identities survive distribution assembly', () => {
  const repository = fileURLToPath(new URL('../../../../', import.meta.url))
  const prefix = 'docs/ai/apps/asyra-sim'
  const targets = new Map(
    distributionFiles(path.join(repository, prefix)).map((file) => [
      `${prefix}/${file}`,
      `docs/${file}`
    ])
  )
  targets.set('apps/asyra-sim/README.md', 'USER_GUIDE.md')
  targets.set(`${prefix}/release/LOCAL_CANDIDATE.md`, 'README.md')
  for (const [source] of targets) {
    if (!source.endsWith('.md')) continue
    const result = rewriteDistributionMarkdown(
      readFileSync(path.join(repository, source), 'utf8'),
      source,
      targets,
      repository,
      'a'.repeat(40)
    )
    assert.ok(result.length > 0)
  }
  const notices = path.join(repository, 'apps/asyra-sim/scripts/notices')
  for (const record of Object.values(
    JSON.parse(readFileSync(path.join(notices, 'sources.json'), 'utf8'))
  )) {
    assert.equal(sha256(path.join(notices, record.file)), record.sha256)
    assert.match(
      record.source,
      /^https:\/\/raw\.githubusercontent\.com\/.+\/[a-f0-9]{40}\//
    )
  }
})

function fixture(t) {
  const parent = fileURLToPath(
    new URL('../../.artifacts/consumer-tests/', import.meta.url)
  )
  mkdirSync(parent, { recursive: true })
  const root = mkdtempSync(path.join(parent, 'distribution-'))
  t.after(() => rmSync(root, { recursive: true }))
  const write = (name, text = '') => {
    const file = path.join(root, name)
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, text)
    return file
  }
  return { root, write }
}

test('candidate checksums cover every file and reject modification, omission, additions and symlinks', (t) => {
  const { root, write } = fixture(t)
  write('site/index.html', '<html></html>')
  write('server.mjs', '// launcher')
  write('SHA256SUMS', checksumText(root))
  verifyDistribution(root)
  assert.deepEqual(distributionFiles(root), [
    'SHA256SUMS',
    'server.mjs',
    'site/index.html'
  ])
  write('site/index.html', 'changed')
  assert.throws(() => verifyDistribution(root), /missing, added or changed/)
  write('site/index.html', '<html></html>')
  write('extra.txt', 'unexpected')
  assert.throws(() => verifyDistribution(root), /missing, added or changed/)
  rmSync(path.join(root, 'extra.txt'))
  rmSync(path.join(root, 'server.mjs'))
  assert.throws(() => verifyDistribution(root), /missing, added or changed/)
  symlinkSync(path.join(root, 'site/index.html'), path.join(root, 'server.mjs'))
  assert.throws(() => verifyDistribution(root), /symlink/)
})

test('documentation stays local when shipped, labels source-only references, opens external links separately and rejects broken targets', (t) => {
  const { root, write } = fixture(t)
  write('app/README.md')
  write('docs/guide.md')
  write('source/api.ts')
  const targets = new Map([
    ['app/README.md', 'USER_GUIDE.md'],
    ['docs/guide.md', 'docs/guide.md']
  ])
  const commit = 'a'.repeat(40)
  const rewrite = (text) =>
    rewriteDistributionMarkdown(text, 'app/README.md', targets, root, commit)
  assert.equal(
    rewrite('[guide](../docs/guide.md#start)'),
    '[guide](docs/guide.md#start)'
  )
  assert.equal(rewrite('[section](#start)'), '[section](#start)')
  assert.equal(
    rewrite('[API](../source/api.ts)'),
    `API (source-only reference: \`source/api.ts\` at \`${commit}\`; not included)`
  )
  assert.match(
    rewrite('[external](https://example.com/)'),
    /target="_blank" rel="noopener noreferrer"/
  )
  assert.throws(() => rewrite('[broken](../missing.md)'), /ENOENT/)
  assert.throws(() => rewrite('[escape](../../outside.md)'), /escapes source/)
  symlinkSync(
    path.join(root, 'docs/guide.md'),
    path.join(root, 'docs/linked.md')
  )
  assert.throws(
    () => rewrite('[linked](../docs/linked.md)'),
    /Invalid documentation/
  )
})

test('notices use actual bundled package identities and original texts, requiring exact hashed supplements when absent', (t) => {
  const { root, write } = fixture(t)
  const consumer = path.join(root, 'app'),
    supplements = path.join(root, 'supplements')
  write(
    'app/node_modules/example/package.json',
    JSON.stringify({ name: 'example', version: '1.0.0', license: 'MIT' })
  )
  write('app/node_modules/example/index.js', 'export const value = 1')
  const license = write(
    'app/node_modules/example/LICENSE',
    'Original copyright and permission'
  )
  write(
    'app/.build-evidence/main.json',
    JSON.stringify(['node_modules/example/index.js'])
  )
  write('supplements/sources.json', '{}')
  const original = bundledNotices(consumer, supplements)
  assert.equal(original.length, 1)
  assert.equal(original[0].name, 'example')
  assert.equal(original[0].version, '1.0.0')
  assert.equal(original[0].notices[0].sha256, sha256(license))
  assert.equal(original[0].notices[0].text, 'Original copyright and permission')
  rmSync(license)
  assert.throws(
    () => bundledNotices(consumer, supplements),
    /Missing original license/
  )
  const replacement = write(
    'supplements/original.txt',
    'Preserved original license'
  )
  write(
    'supplements/sources.json',
    JSON.stringify({
      'example@1.0.0': {
        license: 'MIT',
        file: 'original.txt',
        source: 'https://example.com/exact-source',
        sha256: sha256(replacement)
      }
    })
  )
  assert.equal(
    bundledNotices(consumer, supplements)[0].notices[0].text,
    'Preserved original license'
  )
  write('supplements/original.txt', 'altered')
  assert.throws(
    () => bundledNotices(consumer, supplements),
    /Changed supplemental/
  )
  write('outside.js', 'private')
  write('app/.build-evidence/main.json', JSON.stringify(['../outside.js']))
  assert.throws(() => bundledNotices(consumer, supplements), /escaped/)
})

test('the producer stages a complete versioned candidate without serving SDK data or finalizing failed assembly', (t) => {
  const { root, write } = fixture(t)
  const snapshot = path.join(root, 'source'),
    consumer = path.join(root, 'app'),
    output = path.join(root, 'output')
  const docs = 'source/docs/ai/apps/asyra-sim'
  write(
    `${docs}/release/LOCAL_CANDIDATE.md`,
    '# Start\n[Guide](../../../../../apps/asyra-sim/README.md)'
  )
  write('source/apps/asyra-sim/README.md', '# User guide')
  write('source/LICENSE', 'Project license')
  for (const file of [
    'local-server.mjs',
    'verify-files.mjs',
    'distribution-files.mjs',
    'run-e2e.mjs'
  ])
    write(`source/apps/asyra-sim/scripts/${file}`, '// source input')
  write('source/apps/asyra-sim/scripts/notices/sources.json', '{}')
  for (const folder of ['src', 'samples', 'e2e'])
    write(`app/${folder}/input.ts`, '// app input')
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
    write(`app/${file}`, 'input')
  write('app/dist/index.html', '<html>App</html>')
  write('app/dist/assets/main.js', '// production')
  write(
    'app/.build-evidence/main.json',
    JSON.stringify(['node_modules/example/index.js'])
  )
  write('app/node_modules/example/index.js', '// dependency')
  write(
    'app/node_modules/example/package.json',
    JSON.stringify({ name: 'example', version: '1.0.0', license: 'MIT' })
  )
  write('app/node_modules/example/LICENSE', 'Original permission')
  write('output/framework/example.tgz', 'packed input')
  mkdirSync(path.join(output, 'tmp'))
  const report = {
    status: 'independent-build-passed',
    sourceCommit: 'a'.repeat(40),
    appVersion: '0.1.0-alpha.0'
  }
  const candidate = assembleDistribution({ snapshot, consumer, output, report })
  assert.match(candidate, /asyra-sim-0\.1\.0-alpha\.0-aaaaaaaaaaaa$/)
  verifyDistribution(candidate)
  assert.deepEqual(distributionFiles(path.join(candidate, 'site')), [
    'assets/main.js',
    'index.html'
  ])
  assert.equal(
    readFileSync(path.join(candidate, 'README.md'), 'utf8'),
    '# Start\n[Guide](USER_GUIDE.md)'
  )
  assert.ok(distributionFiles(candidate).includes('sdk/framework/example.tgz'))
  assert.ok(
    distributionFiles(candidate).includes('sdk/app/app-environment.d.mts')
  )
  assert.match(
    readFileSync(path.join(candidate, 'THIRD_PARTY_NOTICES.txt'), 'utf8'),
    /Original permission/
  )
  assert.equal(
    JSON.parse(readFileSync(path.join(candidate, 'BUILD.json'))).artifactKind,
    'local-developer-candidate'
  )
  assert.deepEqual(readdirSync(output).sort(), ['framework', 'tmp'])
  assert.throws(
    () =>
      assembleDistribution({
        snapshot,
        consumer,
        output,
        report: { ...report, status: 'failed' }
      }),
    /requires passing/
  )
  rmSync(path.join(consumer, 'node_modules/example/LICENSE'))
  assert.throws(
    () => assembleDistribution({ snapshot, consumer, output, report }),
    /Missing original license/
  )
  assert.deepEqual(readdirSync(output).sort(), ['framework', 'tmp'])
})
