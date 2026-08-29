import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

export const FRAMEWORK_RELEASE_PACKAGE_NAMES = Object.freeze([
  '@asyra/ai-agent-runtime',
  '@asyra/collaboration',
  '@asyra/core',
  '@asyra/design-system',
  '@asyra/factory',
  '@asyra/feature-system',
  '@asyra/input-system',
  '@asyra/persistence',
  '@asyra/preset',
  '@asyra/props-manager',
  '@asyra/reactive-events',
  '@asyra/render',
  '@asyra/render-engine',
  '@asyra/render-engine-pixi',
  '@asyra/scene-tree',
  '@asyra/selection',
  '@asyra/system-context',
  '@asyra/ui-context',
  '@asyra/utils'
])

export const FRAMEWORK_RELEASE_PREREQUISITES = Object.freeze([
  Object.freeze({
    gate: 1,
    planPath:
      'docs/ai/framework/plans/completed/props-manager-app-level-migration-plan.md',
    inspectorPath:
      'tools/flow-inspector/inspectors/app-level-migration-flow-inspector.data.cjs',
    contractTestPath:
      'tools/flow-inspector/inspectors/__tests__/app-level-migration-flow-inspector.contract.test.cjs',
    completedPattern:
      /Status: completed on July 19, 2026; Framework Release Gate 1 closeout/,
    decisionPattern:
      /## 2026-07-19 - Confirm app-level migration Gate 1 closeout/
  }),
  Object.freeze({
    gate: 2,
    planPath:
      'docs/ai/framework/plans/completed/network-collaboration-transport-plan.md',
    inspectorPath:
      'tools/flow-inspector/inspectors/network-collaboration-transport-flow-inspector.data.cjs',
    contractTestPath:
      'tools/flow-inspector/inspectors/__tests__/network-collaboration-transport-flow-inspector.contract.test.cjs',
    completedPattern: /Completed and approved for closeout on 2026-07-23/,
    decisionPattern:
      /## 2026-07-23 - Close network collaboration transport Release Gate 2/
  }),
  Object.freeze({
    gate: 3,
    planPath:
      'docs/ai/framework/plans/completed/group-component-and-hierarchy-behaviors-plan.md',
    inspectorPath:
      'tools/flow-inspector/inspectors/group-component-and-hierarchy-flow-inspector.data.cjs',
    contractTestPath:
      'tools/flow-inspector/inspectors/__tests__/group-component-and-hierarchy-flow-inspector.contract.test.cjs',
    completedPattern:
      /Framework Release Gate 3 completed and approved for closeout on 2026-07-24/,
    decisionPattern:
      /## 2026-07-24 - Close Group component and hierarchy Release Gate 3/
  }),
  Object.freeze({
    gate: 4,
    planPath: 'docs/ai/framework/plans/completed/ai-agent-runtime-plan.md',
    inspectorPath:
      'tools/flow-inspector/inspectors/ai-agent-runtime-flow-inspector.data.cjs',
    contractTestPath:
      'tools/flow-inspector/inspectors/__tests__/ai-agent-runtime-flow-inspector.contract.test.cjs',
    completedPattern: /Framework Release Gate 4 was completed on 2026-07-25/,
    decisionPattern:
      /## 2026-07-25 - Close optional AI Agent Runtime Release Gate 4/
  })
])

export const FRAMEWORK_RELEASE_UNSUPPORTED_CAPABILITIES = Object.freeze([
  'auto-layout',
  'unit-aware-aggregation',
  'production-3d',
  'production-hybrid'
])

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'))

const freeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value
  }
  Object.freeze(value)
  Object.values(value).forEach(freeze)
  return value
}

const readGitBaseline = (repositoryRoot) => {
  const runGit = (args) =>
    execFileSync('git', args, {
      cwd: repositoryRoot,
      encoding: 'utf8'
    }).trim()

  return {
    commit: runGit(['rev-parse', 'HEAD']),
    dirty: runGit(['status', '--porcelain']).length > 0
  }
}

const verifyPrerequisites = (repositoryRoot) => {
  const decisionHistoryPath = path.join(
    repositoryRoot,
    'docs/ai/framework/decisions/releases/unreleased.md'
  )
  const decisionHistory = fs.readFileSync(decisionHistoryPath, 'utf8')

  return FRAMEWORK_RELEASE_PREREQUISITES.map((prerequisite) => {
    for (const relativePath of [
      prerequisite.planPath,
      prerequisite.inspectorPath,
      prerequisite.contractTestPath
    ]) {
      if (!fs.existsSync(path.join(repositoryRoot, relativePath))) {
        throw new Error(
          `Framework Release Gate ${prerequisite.gate} is missing ${relativePath}`
        )
      }
    }

    const plan = fs.readFileSync(
      path.join(repositoryRoot, prerequisite.planPath),
      'utf8'
    )
    if (!prerequisite.completedPattern.test(plan)) {
      throw new Error(
        `Framework Release Gate ${prerequisite.gate} lacks completed-plan evidence`
      )
    }
    if (!/Inspector/i.test(plan)) {
      throw new Error(
        `Framework Release Gate ${prerequisite.gate} lacks retained Inspector authority`
      )
    }
    if (!prerequisite.decisionPattern.test(decisionHistory)) {
      throw new Error(
        `Framework Release Gate ${prerequisite.gate} lacks decision history`
      )
    }

    return {
      gate: prerequisite.gate,
      planPath: prerequisite.planPath,
      inspectorPath: prerequisite.inspectorPath,
      contractTestPath: prerequisite.contractTestPath
    }
  })
}

export const readFrameworkReleaseSource = ({ repositoryRoot }) => {
  const resolvedRoot = path.resolve(repositoryRoot)
  const packagesRoot = path.join(resolvedRoot, 'packages')
  const publicPackages = fs
    .readdirSync(packagesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const manifestPath = path.join(packagesRoot, entry.name, 'package.json')
      if (!fs.existsSync(manifestPath)) return []
      const manifest = readJson(manifestPath)
      if (manifest.private === true) return []
      return [
        {
          directory: entry.name,
          manifestPath: path.relative(resolvedRoot, manifestPath),
          manifest
        }
      ]
    })

  const packagesByName = new Map(
    publicPackages.map((record) => [record.manifest.name, record])
  )
  const unexpectedNames = [...packagesByName.keys()]
    .filter((name) => !FRAMEWORK_RELEASE_PACKAGE_NAMES.includes(name))
    .sort()
  const missingNames = FRAMEWORK_RELEASE_PACKAGE_NAMES.filter(
    (name) => !packagesByName.has(name)
  )

  if (missingNames.length > 0 || unexpectedNames.length > 0) {
    throw new Error(
      `Framework release package set mismatch: missing=[${missingNames.join(
        ', '
      )}] unexpected=[${unexpectedNames.join(', ')}]`
    )
  }

  const packages = FRAMEWORK_RELEASE_PACKAGE_NAMES.map((name) => {
    const record = packagesByName.get(name)
    const expectedDirectory = name.slice('@asyra/'.length)
    if (record.directory !== expectedDirectory) {
      throw new Error(
        `${name} must be owned by packages/${expectedDirectory}, found packages/${record.directory}`
      )
    }

    const manifest = record.manifest
    return {
      name,
      directory: record.directory,
      manifestPath: record.manifestPath,
      version: manifest.version,
      private: manifest.private === true,
      license: manifest.license,
      main: manifest.main,
      module: manifest.module,
      types: manifest.types,
      exports: manifest.exports,
      files: manifest.files,
      dependencies: manifest.dependencies ?? {},
      peerDependencies: manifest.peerDependencies ?? {}
    }
  })

  const baseline = readGitBaseline(resolvedRoot)
  baseline.packageCount = packages.length

  return freeze({
    baseline,
    packages,
    prerequisites: verifyPrerequisites(resolvedRoot),
    unsupportedCapabilities: [...FRAMEWORK_RELEASE_UNSUPPORTED_CAPABILITIES]
  })
}
