import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import {
  cp,
  lstat,
  mkdir,
  readFile,
  readlink,
  realpath,
  rename,
  rm,
  symlink,
  writeFile
} from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { gunzipSync, gzipSync } from 'node:zlib'

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url))
const defaultAppRoot = path.resolve(moduleDirectory, '..')
const defaultWorkspaceRoot = path.resolve(defaultAppRoot, '../..')
const responseDirectoryRelativePath = path.join(
  '__endpoint-test__',
  'server-responses'
)
const manifestFilename = 'manifest.json'

export const PREPARED_SERVER_RESPONSE_MANIFEST_VERSION = 1

export const resolvePreparedServerResponseLayoutRoot = ({
  appRoot = defaultAppRoot,
  manifest = JSON.parse(
    readFileSync(path.join(appRoot, 'package.json'), 'utf8')
  ),
  workspaceRoot = defaultWorkspaceRoot
} = {}) => {
  const dependencySpecifiers = Object.values({
    ...(manifest.dependencies ?? {}),
    ...(manifest.devDependencies ?? {}),
    ...(manifest.peerDependencies ?? {})
  })
  const usesWorkspacePackages = dependencySpecifiers.some(
    (specifier) =>
      typeof specifier === 'string' && specifier.startsWith('workspace:')
  )
  return path.resolve(usesWorkspacePackages ? workspaceRoot : appRoot)
}

const defaultLayoutRoot = resolvePreparedServerResponseLayoutRoot()

export const PREPARED_SERVER_RESPONSE_VARIANTS = Object.freeze(
  [16, 320, 1280, 7075, 27471].map((itemCount) =>
    Object.freeze({
      fileId: `endpoint-performance-response-${itemCount}`,
      gzipFilename: `server-response-${itemCount}.json.gzip`,
      itemCount,
      publicPath: `/__endpoint-test__/server-responses/server-response-${itemCount}.json.gzip`
    })
  )
)

const variantsByItemCount = new Map(
  PREPARED_SERVER_RESPONSE_VARIANTS.map((variant) => [
    variant.itemCount,
    variant
  ])
)

const sha256 = (value) => createHash('sha256').update(value).digest('hex')

const isSameOrInside = (parentPath, candidatePath) => {
  const relative = path.relative(parentPath, candidatePath)
  return (
    relative === '' ||
    (relative !== '..' &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  )
}

const requireDisjointDirectories = (firstPath, secondPath) => {
  if (
    isSameOrInside(firstPath, secondPath) ||
    isSameOrInside(secondPath, firstPath)
  ) {
    throw new Error(
      'Prepared server response preview and production dist must be disjoint.'
    )
  }
}

const requireNonNegativeInteger = (value, label) => {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Prepared server response ${label} must be an integer.`)
  }
  return value
}

const readRecordEvidence = (record, variant) => {
  if (
    !record ||
    typeof record !== 'object' ||
    record.fileId !== variant.fileId ||
    !record.batch ||
    typeof record.batch !== 'object' ||
    !Array.isArray(record.batch.actions) ||
    record.batch.actions.length === 0
  ) {
    throw new Error(
      `Prepared server response ${variant.itemCount} has an invalid action batch.`
    )
  }

  let elementCount = 0
  let pointCount = 0
  let sliceCount = 0
  let totalCount = 0
  for (const action of record.batch.actions) {
    const artifact = action?.arguments
    if (
      !artifact ||
      typeof artifact !== 'object' ||
      !artifact.groupDescriptor ||
      typeof artifact.groupDescriptor !== 'object' ||
      !Array.isArray(artifact.slices)
    ) {
      throw new Error(
        `Prepared server response ${variant.itemCount} contains an invalid drawing artifact.`
      )
    }
    const actionElementCount = requireNonNegativeInteger(
      artifact.elementCount,
      'elementCount'
    )
    elementCount += actionElementCount
    pointCount += requireNonNegativeInteger(artifact.pointCount, 'pointCount')
    sliceCount += artifact.slices.length
    totalCount += actionElementCount + 1
  }

  return {
    actionCount: record.batch.actions.length,
    elementCount,
    pointCount,
    sliceCount,
    totalCount
  }
}

const requireManifestShape = (manifest) => {
  if (
    !manifest ||
    typeof manifest !== 'object' ||
    manifest.version !== PREPARED_SERVER_RESPONSE_MANIFEST_VERSION ||
    typeof manifest.productionIndexSha256 !== 'string' ||
    typeof manifest.sourceActionBatchSha256 !== 'string' ||
    !Array.isArray(manifest.variants) ||
    manifest.variants.length !== PREPARED_SERVER_RESPONSE_VARIANTS.length
  ) {
    throw new Error('Prepared server response manifest is invalid.')
  }

  PREPARED_SERVER_RESPONSE_VARIANTS.forEach((variant, index) => {
    const entry = manifest.variants[index]
    if (
      !entry ||
      entry.fileId !== variant.fileId ||
      entry.itemCount !== variant.itemCount ||
      entry.publicPath !== variant.publicPath ||
      !Number.isInteger(entry.actionCount) ||
      !Number.isInteger(entry.elementCount) ||
      !Number.isInteger(entry.totalCount) ||
      !Number.isInteger(entry.pointCount) ||
      !Number.isInteger(entry.sliceCount) ||
      !Number.isInteger(entry.gzipBytes) ||
      typeof entry.rawSha256 !== 'string' ||
      typeof entry.gzipSha256 !== 'string'
    ) {
      throw new Error(
        `Prepared server response manifest entry ${variant.itemCount} is invalid.`
      )
    }
  })
}

export const getPreparedServerResponseVariant = (itemCount) => {
  const variant = variantsByItemCount.get(itemCount)
  if (!variant) {
    throw new Error(
      `Unsupported prepared server response item count: ${String(itemCount)}`
    )
  }
  return variant
}

export const resolvePreparedServerResponsePreviewPaths = ({
  previewRoot = path.join(defaultLayoutRoot, 'tmp', 'endpoint-preview'),
  processId = process.pid,
  productionDistPath = path.join(defaultAppRoot, 'dist', 'frontend'),
  sourceActionBatchPath = path.join(
    defaultAppRoot,
    'samples',
    'crdt-7076',
    'action-batch.json'
  )
} = {}) => {
  if (!Number.isInteger(processId) || processId <= 0) {
    throw new Error('Prepared server response processId must be positive.')
  }
  const absolutePreviewRoot = path.resolve(previewRoot)
  const absoluteProductionDistPath = path.resolve(productionDistPath)
  requireDisjointDirectories(absolutePreviewRoot, absoluteProductionDistPath)
  const currentPath = path.join(absolutePreviewRoot, 'current')
  const stagingPath = path.join(absolutePreviewRoot, `staging-${processId}`)

  return Object.freeze({
    currentPath,
    manifestPath: path.join(
      currentPath,
      responseDirectoryRelativePath,
      manifestFilename
    ),
    previewRoot: absolutePreviewRoot,
    productionDistPath: absoluteProductionDistPath,
    productionIndexPath: path.join(absoluteProductionDistPath, 'index.html'),
    responseDirectoryPath: path.join(
      stagingPath,
      responseDirectoryRelativePath
    ),
    sourceActionBatchPath: path.resolve(sourceActionBatchPath),
    stagingPath
  })
}

export const createPreparedServerResponseArtifacts = async ({
  createRecord,
  onArtifact,
  productionIndex,
  retainArtifacts = true,
  sourceActionBatch
}) => {
  if (typeof createRecord !== 'function') {
    throw new Error(
      'Prepared server response generation requires createRecord().'
    )
  }
  const productionIndexBytes = Buffer.from(productionIndex)
  const sourceActionBatchBytes = Buffer.from(sourceActionBatch)
  const artifacts = []
  const manifestEntries = []

  for (const variant of PREPARED_SERVER_RESPONSE_VARIANTS) {
    const record = await createRecord(variant.fileId, variant.itemCount)
    const evidence = readRecordEvidence(record, variant)
    const raw = Buffer.from(JSON.stringify(record))
    const gzip = gzipSync(raw, { level: 6 })
    const manifestEntry = Object.freeze({
      fileId: variant.fileId,
      itemCount: variant.itemCount,
      totalCount: evidence.totalCount,
      actionCount: evidence.actionCount,
      elementCount: evidence.elementCount,
      pointCount: evidence.pointCount,
      sliceCount: evidence.sliceCount,
      rawSha256: sha256(raw),
      gzipSha256: sha256(gzip),
      gzipBytes: gzip.byteLength,
      publicPath: variant.publicPath
    })
    const artifact = Object.freeze({
      gzip,
      manifestEntry,
      variant
    })
    if (typeof onArtifact === 'function') {
      await onArtifact(artifact)
    }
    if (retainArtifacts) {
      artifacts.push(artifact)
    }
    manifestEntries.push(manifestEntry)
  }

  const manifest = Object.freeze({
    version: PREPARED_SERVER_RESPONSE_MANIFEST_VERSION,
    productionIndexSha256: sha256(productionIndexBytes),
    sourceActionBatchSha256: sha256(sourceActionBatchBytes),
    variants: Object.freeze(manifestEntries)
  })

  return Object.freeze({
    artifacts: Object.freeze(artifacts),
    manifest
  })
}

export const loadServerResponseRecordFactory = async () => {
  const { createServer } = await import('vite')
  const server = await createServer({
    appType: 'custom',
    clearScreen: false,
    configFile: false,
    logLevel: 'silent',
    root: defaultAppRoot,
    server: {
      hmr: false,
      middlewareMode: true,
      open: false,
      watch: null
    }
  })

  try {
    const loaded = await server.ssrLoadModule(
      '/e2e/action-batch-interceptor.ts'
    )
    if (typeof loaded.createServerResponseRecord !== 'function') {
      throw new Error('Vite did not load createServerResponseRecord().')
    }
    return {
      close: () => server.close(),
      createRecord: loaded.createServerResponseRecord
    }
  } catch (error) {
    await server.close()
    throw error
  }
}

const publishCurrentOverlay = async ({
  currentPath,
  previewRoot,
  processId,
  stagingPath
}) => {
  const nextPointerPath = path.join(previewRoot, `.current-${processId}`)
  await rm(nextPointerPath, { force: true })
  await symlink(path.basename(stagingPath), nextPointerPath, 'dir')

  let previousTargetPath
  let replaced = false
  try {
    const currentStat = await lstat(currentPath)
    if (!currentStat.isSymbolicLink()) {
      throw new Error(
        'Prepared server response current overlay must be a symbolic link.'
      )
    }
    previousTargetPath = path.resolve(previewRoot, await readlink(currentPath))
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      await rm(nextPointerPath, { force: true })
      throw error
    }
  }

  try {
    await rename(nextPointerPath, currentPath)
    replaced = true
  } finally {
    if (!replaced) {
      await rm(nextPointerPath, { force: true })
    }
  }

  if (
    previousTargetPath &&
    previousTargetPath !== stagingPath &&
    path.dirname(previousTargetPath) === previewRoot &&
    path.basename(previousTargetPath).startsWith('staging-')
  ) {
    await rm(previousTargetPath, { force: true, recursive: true }).catch(
      () => undefined
    )
  }
}

export const prepareServerResponsePreview = async ({
  createRecord,
  previewRoot,
  processId,
  productionDistPath,
  sourceActionBatchPath
} = {}) => {
  const paths = resolvePreparedServerResponsePreviewPaths({
    previewRoot,
    processId,
    productionDistPath,
    sourceActionBatchPath
  })
  const [productionIndex, sourceActionBatch] = await Promise.all([
    readFile(paths.productionIndexPath),
    readFile(paths.sourceActionBatchPath)
  ])
  let loadedFactory
  let published = false

  try {
    await lstat(paths.stagingPath)
    throw new Error(
      `Prepared server response staging path already exists: ${paths.stagingPath}`
    )
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error
    }
  }

  try {
    await mkdir(paths.previewRoot, { recursive: true })
    const [realPreviewRoot, realProductionDistPath] = await Promise.all([
      realpath(paths.previewRoot),
      realpath(paths.productionDistPath)
    ])
    requireDisjointDirectories(realPreviewRoot, realProductionDistPath)
    await cp(paths.productionDistPath, paths.stagingPath, {
      errorOnExist: true,
      force: false,
      recursive: true
    })
    await mkdir(paths.responseDirectoryPath, { recursive: true })

    if (typeof createRecord !== 'function') {
      loadedFactory = await loadServerResponseRecordFactory()
      createRecord = loadedFactory.createRecord
    }
    const result = await createPreparedServerResponseArtifacts({
      createRecord,
      onArtifact: ({ gzip, variant }) =>
        writeFile(
          path.join(paths.responseDirectoryPath, variant.gzipFilename),
          gzip
        ),
      productionIndex,
      retainArtifacts: false,
      sourceActionBatch
    })
    await loadedFactory?.close()
    loadedFactory = undefined
    await writeFile(
      path.join(paths.responseDirectoryPath, manifestFilename),
      `${JSON.stringify(result.manifest, null, 2)}\n`
    )
    await publishCurrentOverlay({
      currentPath: paths.currentPath,
      previewRoot: paths.previewRoot,
      processId: processId ?? process.pid,
      stagingPath: paths.stagingPath
    })
    published = true

    return Object.freeze({
      currentPath: paths.currentPath,
      manifest: result.manifest,
      manifestPath: paths.manifestPath,
      productionIndexSha256: result.manifest.productionIndexSha256
    })
  } finally {
    await loadedFactory?.close()
    if (!published) {
      await rm(paths.stagingPath, { force: true, recursive: true })
    }
  }
}

export const attestPreparedServerResponsePreview = async ({
  previewRoot,
  productionDistPath,
  sourceActionBatchPath
} = {}) => {
  const paths = resolvePreparedServerResponsePreviewPaths({
    previewRoot,
    productionDistPath,
    sourceActionBatchPath
  })
  const currentStat = await lstat(paths.currentPath)
  if (!currentStat.isSymbolicLink()) {
    throw new Error(
      'Prepared server response current overlay is not an atomic pointer.'
    )
  }
  const currentTargetPath = path.resolve(
    paths.previewRoot,
    await readlink(paths.currentPath)
  )
  if (
    path.dirname(currentTargetPath) !== paths.previewRoot ||
    !path.basename(currentTargetPath).startsWith('staging-')
  ) {
    throw new Error(
      'Prepared server response current overlay target is invalid.'
    )
  }

  const [manifestBytes, productionIndex, overlayIndex, sourceActionBatch] =
    await Promise.all([
      readFile(paths.manifestPath),
      readFile(paths.productionIndexPath),
      readFile(path.join(paths.currentPath, 'index.html')),
      readFile(paths.sourceActionBatchPath)
    ])
  const manifest = JSON.parse(manifestBytes.toString('utf8'))
  requireManifestShape(manifest)
  const productionIndexSha256 = sha256(productionIndex)
  if (
    manifest.productionIndexSha256 !== productionIndexSha256 ||
    sha256(overlayIndex) !== productionIndexSha256
  ) {
    throw new Error(
      'Prepared server response preview does not match the production index.'
    )
  }
  if (manifest.sourceActionBatchSha256 !== sha256(sourceActionBatch)) {
    throw new Error(
      'Prepared server response preview does not match the source action batch.'
    )
  }

  for (const [index, variant] of PREPARED_SERVER_RESPONSE_VARIANTS.entries()) {
    const entry = manifest.variants[index]
    const gzip = await readFile(
      path.join(
        paths.currentPath,
        responseDirectoryRelativePath,
        variant.gzipFilename
      )
    )
    if (
      gzip.byteLength !== entry.gzipBytes ||
      sha256(gzip) !== entry.gzipSha256
    ) {
      throw new Error(
        `Prepared server response gzip ${variant.itemCount} failed attestation.`
      )
    }
    const raw = gunzipSync(gzip)
    if (sha256(raw) !== entry.rawSha256) {
      throw new Error(
        `Prepared server response record ${variant.itemCount} failed attestation.`
      )
    }
    const record = JSON.parse(raw.toString('utf8'))
    const evidence = readRecordEvidence(record, variant)
    if (
      evidence.actionCount !== entry.actionCount ||
      evidence.elementCount !== entry.elementCount ||
      evidence.totalCount !== entry.totalCount ||
      evidence.pointCount !== entry.pointCount ||
      evidence.sliceCount !== entry.sliceCount
    ) {
      throw new Error(
        `Prepared server response evidence ${variant.itemCount} failed attestation.`
      )
    }
  }

  return Object.freeze({
    currentPath: paths.currentPath,
    manifest,
    manifestPath: paths.manifestPath,
    productionIndexSha256
  })
}
