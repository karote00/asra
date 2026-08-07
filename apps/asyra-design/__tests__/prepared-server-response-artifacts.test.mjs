import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readlink,
  readdir,
  rm,
  writeFile
} from 'node:fs/promises'
import { gunzipSync, gzipSync } from 'node:zlib'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  PREPARED_SERVER_RESPONSE_MANIFEST_VERSION,
  PREPARED_SERVER_RESPONSE_VARIANTS,
  attestPreparedServerResponsePreview,
  createPreparedServerResponseArtifacts,
  getPreparedServerResponseVariant,
  loadServerResponseRecordFactory,
  prepareServerResponsePreview,
  resolvePreparedServerResponseLayoutRoot
} from '../e2e/prepared-server-response-artifacts.mjs'

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..'
)

const sha256 = (value) => createHash('sha256').update(value).digest('hex')

const createSmallRecord = async (fileId, itemCount) => ({
  batch: {
    actions: [
      {
        arguments: {
          elementCount: 2,
          groupDescriptor: {
            id: `group-${fileId}`
          },
          pointCount: itemCount + 3,
          slices: [
            {
              descriptors: [{ id: `first-${fileId}` }],
              pointCount: itemCount + 1,
              roles: ['first']
            },
            {
              descriptors: [{ id: `second-${fileId}` }],
              pointCount: 2,
              roles: ['second']
            }
          ]
        },
        id: `action-${fileId}`,
        name: 'insert-vector-composition',
        summary: {
          affectedCount: 2,
          pointCount: itemCount + 3,
          skippedCount: 0
        }
      }
    ],
    batchId: `batch-${fileId}`,
    explanation: 'Prepared response artifact test record'
  },
  fileId,
  schemaVersion: 1
})

test('resolves workspace and standalone production output from the package contract', () => {
  const workspaceAppRoot = path.join(workspaceRoot, 'apps', 'asyra-design')
  const standaloneAppRoot = path.join(
    workspaceRoot,
    'tmp',
    'standalone-design-app'
  )

  assert.equal(
    resolvePreparedServerResponseLayoutRoot({
      appRoot: workspaceAppRoot,
      manifest: {
        dependencies: {
          '@asyra/core': 'workspace:*'
        }
      },
      workspaceRoot
    }),
    workspaceRoot
  )
  assert.equal(
    resolvePreparedServerResponseLayoutRoot({
      appRoot: standaloneAppRoot,
      manifest: {
        dependencies: {
          '@asyra/core': 'file:../framework-artifacts/asyra-core-0.2.5.tgz'
        }
      },
      workspaceRoot
    }),
    standaloneAppRoot
  )
})

test('defines one fixed file-scoped artifact for every supported response size', () => {
  assert.deepEqual(
    PREPARED_SERVER_RESPONSE_VARIANTS.map((variant) => variant.itemCount),
    [16, 320, 1280, 7075, 27471]
  )
  assert.equal(new Set(PREPARED_SERVER_RESPONSE_VARIANTS).size, 5)
  assert.equal(
    new Set(PREPARED_SERVER_RESPONSE_VARIANTS.map((variant) => variant.fileId))
      .size,
    5
  )
  assert.equal(
    new Set(
      PREPARED_SERVER_RESPONSE_VARIANTS.map((variant) => variant.publicPath)
    ).size,
    5
  )

  for (const itemCount of [16, 320, 1280, 7075, 27471]) {
    assert.deepEqual(getPreparedServerResponseVariant(itemCount), {
      fileId: `endpoint-performance-response-${itemCount}`,
      gzipFilename: `server-response-${itemCount}.json.gzip`,
      itemCount,
      publicPath: `/__endpoint-test__/server-responses/server-response-${itemCount}.json.gzip`
    })
  }
  assert.throws(
    () => getPreparedServerResponseVariant(17),
    /Unsupported prepared server response item count/
  )
})

test('creates deterministic gzip-6 records and a complete bounded manifest', async () => {
  const productionIndex = Buffer.from(
    '<!doctype html><title>production</title>'
  )
  const sourceActionBatch = Buffer.from('{"batchId":"sample"}')
  const calls = []
  const createRecord = async (fileId, itemCount) => {
    calls.push({ fileId, itemCount })
    return createSmallRecord(fileId, itemCount)
  }

  const first = await createPreparedServerResponseArtifacts({
    createRecord,
    productionIndex,
    sourceActionBatch
  })
  const second = await createPreparedServerResponseArtifacts({
    createRecord,
    productionIndex,
    sourceActionBatch
  })

  assert.equal(
    first.manifest.version,
    PREPARED_SERVER_RESPONSE_MANIFEST_VERSION
  )
  assert.equal(first.manifest.productionIndexSha256, sha256(productionIndex))
  assert.equal(
    first.manifest.sourceActionBatchSha256,
    sha256(sourceActionBatch)
  )
  assert.deepEqual(first.manifest, second.manifest)
  assert.deepEqual(
    calls.map(({ itemCount }) => itemCount),
    [16, 320, 1280, 7075, 27471, 16, 320, 1280, 7075, 27471]
  )
  assert.equal(first.artifacts.length, 5)

  first.artifacts.forEach((artifact, index) => {
    const repeated = second.artifacts[index]
    const rawRecord = gunzipSync(artifact.gzip)
    const parsedRecord = JSON.parse(rawRecord.toString('utf8'))
    const variant = PREPARED_SERVER_RESPONSE_VARIANTS[index]

    assert.deepEqual(artifact.gzip, repeated.gzip)
    assert.deepEqual(artifact.gzip, gzipSync(rawRecord, { level: 6 }))
    assert.equal(parsedRecord.fileId, variant.fileId)
    assert.equal(artifact.manifestEntry.actionCount, 1)
    assert.equal(artifact.manifestEntry.elementCount, 2)
    assert.equal(artifact.manifestEntry.totalCount, 3)
    assert.equal(artifact.manifestEntry.pointCount, variant.itemCount + 3)
    assert.equal(artifact.manifestEntry.sliceCount, 2)
    assert.equal(artifact.manifestEntry.rawSha256, sha256(rawRecord))
    assert.equal(artifact.manifestEntry.gzipSha256, sha256(artifact.gzip))
    assert.equal(artifact.manifestEntry.gzipBytes, artifact.gzip.byteLength)
    assert.equal(artifact.manifestEntry.publicPath, variant.publicPath)
  })
})

test('loads the formal record factory through the existing Vite SSR loader without materializing a response', async () => {
  const loaded = await loadServerResponseRecordFactory()
  try {
    assert.equal(typeof loaded.createRecord, 'function')
  } finally {
    await loaded.close()
  }
})

test('copies production output into one atomic current overlay without changing production dist', async () => {
  const testRoot = await mkdtemp(
    path.join(workspaceRoot, 'tmp/prepared-server-response-artifacts-')
  )
  const productionDistPath = path.join(testRoot, 'production-dist')
  const previewRoot = path.join(testRoot, 'preview')
  const productionIndex = '<!doctype html><title>canonical build</title>'
  const sourceActionBatch = '{"batchId":"sample"}'
  const sourceActionBatchPath = path.join(testRoot, 'action-batch.json')

  try {
    await mkdir(path.join(productionDistPath, 'assets'), { recursive: true })
    await Promise.all([
      writeFile(path.join(productionDistPath, 'index.html'), productionIndex),
      writeFile(path.join(productionDistPath, 'assets/app.js'), 'app()'),
      writeFile(sourceActionBatchPath, sourceActionBatch)
    ])
    const productionBefore = await readdir(productionDistPath, {
      recursive: true
    })

    const firstSummary = await prepareServerResponsePreview({
      createRecord: createSmallRecord,
      previewRoot,
      processId: 4242,
      productionDistPath,
      sourceActionBatchPath
    })

    const firstCurrentStat = await lstat(firstSummary.currentPath)
    assert.equal(firstCurrentStat.isSymbolicLink(), true)
    assert.equal(await readlink(firstSummary.currentPath), 'staging-4242')

    const summary = await prepareServerResponsePreview({
      createRecord: createSmallRecord,
      previewRoot,
      processId: 4243,
      productionDistPath,
      sourceActionBatchPath
    })

    const currentStat = await lstat(summary.currentPath)
    assert.equal(currentStat.isSymbolicLink(), true)
    assert.equal(await readlink(summary.currentPath), 'staging-4243')
    assert.deepEqual(summary.manifest, firstSummary.manifest)
    await assert.rejects(
      lstat(path.join(previewRoot, 'staging-4242')),
      /ENOENT/
    )
    assert.equal(
      await readFile(path.join(summary.currentPath, 'index.html'), 'utf8'),
      productionIndex
    )
    assert.equal(
      await readFile(path.join(summary.currentPath, 'assets/app.js'), 'utf8'),
      'app()'
    )

    const attestation = await attestPreparedServerResponsePreview({
      previewRoot,
      productionDistPath,
      sourceActionBatchPath
    })
    assert.equal(attestation.currentPath, summary.currentPath)
    assert.deepEqual(attestation.manifest, summary.manifest)
    assert.equal(attestation.productionIndexSha256, sha256(productionIndex))

    for (const variant of PREPARED_SERVER_RESPONSE_VARIANTS) {
      const compressed = await readFile(
        path.join(
          summary.currentPath,
          '__endpoint-test__/server-responses',
          variant.gzipFilename
        )
      )
      assert.equal(
        JSON.parse(gunzipSync(compressed).toString('utf8')).fileId,
        variant.fileId
      )
    }

    assert.deepEqual(
      await readdir(productionDistPath, { recursive: true }),
      productionBefore
    )
    await assert.rejects(
      lstat(path.join(productionDistPath, '__endpoint-test__')),
      /ENOENT/
    )

    const firstVariantPath = path.join(
      summary.currentPath,
      '__endpoint-test__/server-responses',
      PREPARED_SERVER_RESPONSE_VARIANTS[0].gzipFilename
    )
    const firstVariantGzip = await readFile(firstVariantPath)
    await writeFile(
      firstVariantPath,
      Buffer.concat([firstVariantGzip, Buffer.from([0])])
    )
    await assert.rejects(
      attestPreparedServerResponsePreview({
        previewRoot,
        productionDistPath,
        sourceActionBatchPath
      }),
      /gzip 16 failed attestation/
    )
    await writeFile(firstVariantPath, firstVariantGzip)

    const manifestPath = path.join(
      summary.currentPath,
      '__endpoint-test__/server-responses/manifest.json'
    )
    const invalidManifest = {
      ...summary.manifest,
      productionIndexSha256: '0'.repeat(64)
    }
    await writeFile(manifestPath, JSON.stringify(invalidManifest))
    await assert.rejects(
      attestPreparedServerResponsePreview({
        previewRoot,
        productionDistPath,
        sourceActionBatchPath
      }),
      /does not match the production index/
    )
  } finally {
    await rm(testRoot, { force: true, recursive: true })
  }
})
