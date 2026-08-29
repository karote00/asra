import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { FRAMEWORK_RELEASE_PACKAGE_NAMES } from './framework-release-packages.js'

const EXCLUDED_RELEASE_OWNERS = Object.freeze({
  root: Object.freeze({ name: 'asyra', path: 'package.json' }),
  privateApp: Object.freeze({
    name: '@asyra/asyra-design',
    path: 'apps/asyra-design/package.json'
  }),
  createApp: Object.freeze({
    name: 'create-asyra-design-app',
    path: 'create-app/asyra-design/package.json'
  })
})

const REQUIRED_DOCUMENT_TOKENS = Object.freeze({
  'README.md': ['Current support', 'docs/public/reference/support-release.md'],
  'CHANGELOG.md': ['## [Unreleased]'],
  'RELEASE_NOTES.md': [
    'Framework pre-publication candidate',
    'release decision remains `PENDING`',
    'does not authorize'
  ],
  'SECURITY.md': ['private security advisory', 'Framework Security Boundaries'],
  'docs/ai/framework/RELEASE_SUPPORT.md': [
    'current Framework package manifests',
    'release-readiness evidence',
    'Node.js 24.x',
    'Yarn 4.3.1',
    'TypeScript 5.8.3',
    'React 19',
    '2D',
    'CUSTOM',
    '3D',
    'HYBRID',
    'create-asyra-design-app',
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
  'apps/asyra-design/README.md': [
    'Node.js 24.x',
    'the package manager selected when the project was created'
  ]
})

const COMPLETED_READINESS_PLAN =
  'docs/ai/framework/plans/completed/framework-release-readiness-and-closeout-plan.md'
const READINESS_INSPECTOR =
  'tools/flow-inspector/inspectors/framework-release-readiness-flow-inspector.data.cjs'

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'))

const parseStableVersion = (name, version) => {
  const match = /^(\d+)\.(\d+)\.(\d+)$/u.exec(version)
  if (!match) {
    throw new Error(
      `${name} must use a stable semantic version, found ${version}`
    )
  }
  return {
    version,
    family: `${match[1]}.${match[2]}`,
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3])
  }
}

const compareVersions = (left, right) => {
  const leftParts = left.split('.').map(Number)
  const rightParts = right.split('.').map(Number)
  for (let index = 0; index < leftParts.length; index += 1) {
    const difference = leftParts[index] - rightParts[index]
    if (difference !== 0) return difference
  }
  return 0
}

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

  const excludedVersions = Object.fromEntries(
    Object.entries(EXCLUDED_RELEASE_OWNERS).map(([owner, expected]) => {
      const manifest = readJson(path.join(resolvedRoot, expected.path))
      if (manifest.name !== expected.name) {
        throw new Error(
          `Excluded release owner ${expected.name} resolved to ${manifest.name}`
        )
      }
      parseStableVersion(manifest.name, manifest.version)
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
    const parsedVersion = parseStableVersion(name, manifest.version)
    assertFileContains(
      resolvedRoot,
      path.join('packages', directory, 'README.md'),
      [name, 'Node.js 24.x', 'RELEASE_SUPPORT.md']
    )
    return {
      name,
      version: manifest.version,
      releaseFamily: parsedVersion.family,
      readme: `packages/${directory}/README.md`
    }
  })

  const releaseFamilies = new Set(
    packages.map(({ releaseFamily }) => releaseFamily)
  )
  if (releaseFamilies.size !== 1) {
    throw new Error(
      `Framework packages must remain in one release family, found ${[
        ...releaseFamilies
      ].join(', ')}`
    )
  }
  const [releaseFamily] = releaseFamilies
  const packageVersions = Object.fromEntries(
    packages.map(({ name, version }) => [name, version])
  )
  const releaseVersions = [...new Set(Object.values(packageVersions))].sort(
    compareVersions
  )

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

  return {
    status: 'PASS',
    releaseFamily,
    releaseVersions,
    packageVersions,
    packages,
    excludedVersions,
    pendingChangesets: readPendingChangesets(resolvedRoot),
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
    `Framework release records ${evidence.status}: ${evidence.packages.length} packages in release family ${evidence.releaseFamily}; Gate 5 ${evidence.gate5ReadinessStatus}; publication not authorized`
  )
}
