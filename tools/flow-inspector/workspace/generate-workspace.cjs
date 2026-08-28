/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs')
const path = require('node:path')

const projectRoot = path.resolve(__dirname, '../../..')
const catalogPolicy = require('./catalog.cjs')
const outputPath = path.join(__dirname, 'workspace-bundle.data.js')
const candidatePattern = /-flow-inspector\.data\.(?:cjs|js)$/

const toPosix = (value) => value.split(path.sep).join('/')

const walk = (root) =>
  fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(root, entry.name)
    if (entry.isDirectory()) return walk(entryPath)
    return candidatePattern.test(entry.name) ? [entryPath] : []
  })

const loadSource = (sourcePath) => {
  const resolved = require.resolve(sourcePath)
  Reflect.deleteProperty(require.cache, resolved)
  return require(resolved)
}

const idFromPath = (sourcePath) =>
  path.basename(sourcePath).replace(/-flow-inspector\.data\.(?:cjs|js)$/, '')

const titleFromId = (id) =>
  id
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

const schemaKind = (data) => {
  if (data?.schema?.id === 'flow-inspector' && data.schema.version === 2) {
    return 'flow-v2'
  }
  if (data?.schema === 'flow-inspector.v1') return 'legacy-v1'
  return 'plan-contract'
}

const standalonePathFor = (repoPath) => {
  const direct = repoPath.replace(/\.data\.(?:cjs|js)$/, '.html')
  if (fs.existsSync(path.join(projectRoot, direct))) return direct
  if (repoPath.endsWith('stroke-flow-inspector.data.js')) {
    const strokeEntry = repoPath.replace(
      'stroke-flow-inspector.data.js',
      'stroke-flow-inspector.html'
    )
    if (fs.existsSync(path.join(projectRoot, strokeEntry))) return strokeEntry
  }
  return null
}

const ownerMetadata = (repoPath, id) => {
  const override = catalogPolicy.groupOverrides[id]
  if (override) return override
  const appMatch = repoPath.match(/^docs\/ai\/apps\/([^/]+)\//)
  if (appMatch) {
    return {
      group: 'Apps',
      subgroup: titleFromId(appMatch[1])
    }
  }
  if (repoPath.startsWith('docs/ai/tools/')) {
    return { group: 'Tools', subgroup: 'Flow Inspector' }
  }
  if (/(release|website|public-package|public-readme|runtime-atlas)/.test(id)) {
    return { group: 'Release', subgroup: 'Website and Distribution' }
  }
  return { group: 'Framework', subgroup: 'Architecture and Runtime' }
}

const lifecycleFor = (data) => {
  const specPath = data?.authority?.specPath || ''
  return specPath.includes('/completed/') ? 'retained' : 'current'
}

const exclusionsByPath = new Map(
  catalogPolicy.exclusions.map((entry) => [entry.path, entry.reason])
)

const candidates = catalogPolicy.discoveryRoots
  .flatMap((root) => walk(path.join(projectRoot, root)))
  .map((absolutePath) => toPosix(path.relative(projectRoot, absolutePath)))
  .sort()

const duplicateCandidate = candidates.find(
  (candidate, index) => candidates.indexOf(candidate) !== index
)
if (duplicateCandidate) {
  throw new Error(
    `Duplicate Inspector discovery candidate: ${duplicateCandidate}`
  )
}

for (const excludedPath of exclusionsByPath.keys()) {
  if (!candidates.includes(excludedPath)) {
    throw new Error(
      `Catalog exclusion is not a discovery candidate: ${excludedPath}`
    )
  }
}

const exclusions = candidates
  .filter((repoPath) => exclusionsByPath.has(repoPath))
  .map((repoPath) => ({
    path: repoPath,
    reason: exclusionsByPath.get(repoPath)
  }))

const entries = candidates
  .filter((repoPath) => !exclusionsByPath.has(repoPath))
  .map((repoPath) => {
    const absolutePath = path.join(projectRoot, repoPath)
    const data = loadSource(absolutePath)
    const kind = schemaKind(data)
    const derivedId = idFromPath(repoPath)
    const id = data?.target?.id || derivedId
    const owner = ownerMetadata(repoPath, id)
    if (kind === 'flow-v2' && id !== data.target.id) {
      throw new Error(`Flow v2 catalog id mismatch: ${repoPath}`)
    }
    return {
      id,
      title: data?.target?.title || titleFromId(derivedId),
      kind,
      group: owner.group,
      subgroup: owner.subgroup,
      lifecycle: lifecycleFor(data),
      sourcePath: repoPath,
      standalonePath: standalonePathFor(repoPath),
      labels: [derivedId, owner.group, owner.subgroup, kind],
      data
    }
  })
  .sort((left, right) =>
    `${left.group}:${left.subgroup}:${left.title}:${left.id}`.localeCompare(
      `${right.group}:${right.subgroup}:${right.title}:${right.id}`
    )
  )

const ids = new Set()
for (const entry of entries) {
  if (ids.has(entry.id))
    throw new Error(`Duplicate workspace catalog id: ${entry.id}`)
  ids.add(entry.id)
}

const bundle = {
  schema: { id: 'flow-inspector-workspace-bundle', version: 1 },
  generatedFrom: {
    discoveryRoots: catalogPolicy.discoveryRoots,
    candidatePaths: candidates
  },
  exclusions,
  entries
}

const serialized = JSON.stringify(bundle, null, 2).replaceAll('<', '\\u003c')
const source = `/* Generated by generate-workspace.cjs. Do not edit. */\n;(function (root) {\n  const bundle = ${serialized}\n  root.FLOW_INSPECTOR_WORKSPACE_BUNDLE = bundle\n  if (typeof module !== 'undefined' && module.exports) module.exports = bundle\n})(globalThis)\n`

fs.writeFileSync(outputPath, source)
console.log(
  `Generated ${toPosix(path.relative(projectRoot, outputPath))}: ${entries.length} included, ${exclusions.length} excluded.`
)
