import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { FRAMEWORK_RELEASE_PACKAGE_NAMES } from './framework-release-packages.js'

export const FRAMEWORK_RELEASE_CANDIDATE_VERSION = '0.5.0'

const EXCLUDED_RELEASE_VERSIONS = Object.freeze({
  root: Object.freeze({ name: 'asyra', version: '0.2.5' }),
  privateApp: Object.freeze({
    name: '@asyra/asyra-design',
    version: '0.2.5'
  }),
  createApp: Object.freeze({
    name: 'create-asyra-design-app',
    version: '0.1.0'
  })
})

const REQUIRED_DOCUMENT_TOKENS = Object.freeze({
  'README.md': ['Release support', '0.2.5'],
  'CHANGELOG.md': ['## [Unreleased]', '0.2.5'],
  'RELEASE_NOTES.md': ['0.2.5', 'release readiness', 'does not authorize'],
  'SECURITY.md': ['private security advisory', 'Framework Security Boundaries'],
  'docs/ai/framework/RELEASE_SUPPORT.md': [
    'Node.js 24.x',
    'Yarn 4.3.1',
    'TypeScript 5.8.3',
    'React 19',
    '2D',
    'CUSTOM',
    '3D',
    'HYBRID',
    'setPersistence',
    'RenderGraphics',
    'EngineNeutralRenderStrategy'
  ],
  'docs/ai/framework/API_SURFACES.md': [
    'setPersistence',
    'RenderGraphics',
    'EngineNeutralRenderStrategy',
    'next major release'
  ],
  'docs/ai/workflows/package-release-validation.md': [
    'release:packages',
    'release:consumer',
    'release:template',
    'release:records'
  ],
  'apps/asyra-design/README.md': ['Node.js 24.x', 'Yarn 4.3.1']
})

const COMPLETED_READINESS_PLAN =
  'docs/ai/framework/plans/completed/framework-release-readiness-and-closeout-plan.md'
const READINESS_INSPECTOR =
  'docs/ai/framework/plans/framework-release-readiness-flow-inspector.data.cjs'

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'))

const assertFileContains = (repositoryRoot, relativePath, tokens) => {
  const absolutePath = path.join(repositoryRoot, relativePath)
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Release record is missing ${relativePath}`)
  }
  const contents = fs.readFileSync(absolutePath, 'utf8')
  for (const token of tokens) {
    if (!contents.toLowerCase().includes(token.toLowerCase())) {
      throw new Error(`Release record ${relativePath} is missing "${token}"`)
    }
  }
}

const readPendingChangesets = (repositoryRoot) =>
  fs
    .readdirSync(path.join(repositoryRoot, '.changeset'))
    .filter((entry) => entry.endsWith('.md') && entry !== 'README.md')
    .sort()

export const validateFrameworkReleaseRecords = ({ repositoryRoot }) => {
  const resolvedRoot = path.resolve(repositoryRoot)

  for (const [relativePath, tokens] of Object.entries(
    REQUIRED_DOCUMENT_TOKENS
  )) {
    assertFileContains(resolvedRoot, relativePath, tokens)
  }
  assertFileContains(resolvedRoot, COMPLETED_READINESS_PLAN, [
    'Final decision: `READY`',
    'does not grant merge, tag'
  ])
  assertFileContains(resolvedRoot, READINESS_INSPECTOR, [
    COMPLETED_READINESS_PLAN,
    'artifact:ready-result',
    'publication'
  ])

  const excludedManifestPaths = {
    root: 'package.json',
    privateApp: 'apps/asyra-design/package.json',
    createApp: 'create-app/asyra-design/package.json'
  }
  const excludedVersions = Object.fromEntries(
    Object.entries(excludedManifestPaths).map(([owner, relativePath]) => {
      const manifest = readJson(path.join(resolvedRoot, relativePath))
      const expected = EXCLUDED_RELEASE_VERSIONS[owner]
      if (
        manifest.name !== expected.name ||
        manifest.version !== expected.version
      ) {
        throw new Error(
          `Excluded release owner ${expected.name} must remain ${expected.version}, found ${manifest.name}@${manifest.version}`
        )
      }
      return [owner, { name: manifest.name, version: manifest.version }]
    })
  )

  const packages = FRAMEWORK_RELEASE_PACKAGE_NAMES.map((name) => {
    const directory = name.slice('@asyra/'.length)
    const manifestPath = path.join(
      resolvedRoot,
      'packages',
      directory,
      'package.json'
    )
    const manifest = readJson(manifestPath)
    if (manifest.version !== FRAMEWORK_RELEASE_CANDIDATE_VERSION) {
      throw new Error(
        `${name} must be ${FRAMEWORK_RELEASE_CANDIDATE_VERSION}, found ${manifest.version}`
      )
    }
    assertFileContains(
      resolvedRoot,
      path.join('packages', directory, 'README.md'),
      [name, 'Node.js 24.x', 'RELEASE_SUPPORT.md']
    )
    return {
      name,
      version: manifest.version,
      readme: `packages/${directory}/README.md`
    }
  })

  const changesetConfig = readJson(
    path.join(resolvedRoot, '.changeset', 'config.json')
  )
  if (
    changesetConfig.access !== 'public' ||
    changesetConfig.baseBranch !== 'main'
  ) {
    throw new Error(
      'Changesets must retain public access with main as the release base'
    )
  }

  const releaseSnapshotPath = path.join(
    resolvedRoot,
    'docs',
    'ai',
    'framework',
    'decisions',
    'releases',
    `v${FRAMEWORK_RELEASE_CANDIDATE_VERSION}.md`
  )
  if (fs.existsSync(releaseSnapshotPath)) {
    throw new Error(
      `Release-readiness audit must not create ${path.relative(
        resolvedRoot,
        releaseSnapshotPath
      )}; that snapshot belongs to an authorized release cut`
    )
  }

  return {
    status: 'PASS',
    candidateVersion: FRAMEWORK_RELEASE_CANDIDATE_VERSION,
    packages,
    excludedVersions,
    pendingChangesets: readPendingChangesets(resolvedRoot),
    releaseSnapshot: null,
    gate5ReadinessStatus: 'READY',
    releaseDecision: 'PENDING',
    publicationAuthorized: false
  }
}

const isDirectExecution =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectExecution) {
  const repositoryRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..'
  )
  const evidence = validateFrameworkReleaseRecords({ repositoryRoot })
  const evidenceDirectory = path.join(
    repositoryRoot,
    'tmp',
    'framework-release-evidence'
  )
  fs.mkdirSync(evidenceDirectory, { recursive: true })
  fs.writeFileSync(
    path.join(evidenceDirectory, 'release-records.json'),
    `${JSON.stringify(evidence, null, 2)}\n`
  )
  console.log(
    `Framework release records ${evidence.status}: ${evidence.packages.length} packages at ${evidence.candidateVersion}; Gate 5 ${evidence.gate5ReadinessStatus}; publication not authorized`
  )
}
