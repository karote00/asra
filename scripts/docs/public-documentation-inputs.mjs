import fs from 'node:fs'
import path from 'node:path'

import { readFrameworkReleaseSource } from '../framework-release-packages.js'

const SUPPORT_CONTRACT = 'docs/ai/framework/RELEASE_SUPPORT.md'

const AUTHORITY = {
  allowedRoots: [
    'apps/asyra-design/',
    'create-app/asyra-design/',
    'docs/ai/apps/asyra-design/',
    'docs/ai/framework/',
    'packages/'
  ],
  allowedRootFiles: ['LICENSE', 'SECURITY.md', 'package.json'],
  allowedPlanFiles: [
    'docs/ai/framework/plans/headless-core-and-core-kernel-future-plan.md'
  ],
  allowedResearchFiles: [
    'docs/ai/framework/research/headless-core-and-core-kernel-architecture-research.md'
  ],
  forbiddenSegments: [
    '/audits/',
    '/decisions/',
    '/plans/completed/',
    '/task-breakdowns/'
  ],
  forbiddenTerms: ['credential', 'private endpoint', 'secret', 'token']
}

const freeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value
  }
  Object.freeze(value)
  Object.values(value).forEach(freeze)
  return value
}

const publicEntriesFor = (exportsValue) => {
  if (typeof exportsValue === 'string') return ['.']
  if (!exportsValue || typeof exportsValue !== 'object') return []
  return Object.keys(exportsValue).sort()
}

export const DOCUMENTATION_AUTHORITY = freeze(AUTHORITY)

export const isApprovedDocumentationSource = (sourcePath) => {
  const normalized = sourcePath.replaceAll(path.sep, '/')
  if (
    DOCUMENTATION_AUTHORITY.allowedRootFiles.includes(normalized) ||
    DOCUMENTATION_AUTHORITY.allowedPlanFiles.includes(normalized) ||
    DOCUMENTATION_AUTHORITY.allowedResearchFiles.includes(normalized)
  ) {
    return true
  }
  if (
    normalized.includes('/plans/') ||
    normalized.includes('/research/') ||
    DOCUMENTATION_AUTHORITY.forbiddenSegments.some((segment) =>
      normalized.includes(segment)
    )
  ) {
    return false
  }
  return DOCUMENTATION_AUTHORITY.allowedRoots.some((root) =>
    normalized.startsWith(root)
  )
}

export const readApprovedDocumentationInputs = async ({ repositoryRoot }) => {
  const root = path.resolve(repositoryRoot)
  const releaseSource = readFrameworkReleaseSource({ repositoryRoot: root })
  const rootManifest = JSON.parse(
    fs.readFileSync(path.join(root, 'package.json'), 'utf8')
  )
  const releaseFamilies = new Set(
    releaseSource.packages.map(({ version }) =>
      version.split('.').slice(0, 2).join('.')
    )
  )
  if (releaseFamilies.size !== 1) {
    throw new Error(
      `Public documentation requires one Framework release family, found ${[
        ...releaseFamilies
      ].join(', ')}`
    )
  }
  const [releaseFamily] = releaseFamilies

  const packages = releaseSource.packages.map((releasePackage) => {
    return {
      contractPath: `docs/ai/framework/packages/${releasePackage.directory}.md`,
      directory: releasePackage.directory,
      frameworkDependencies: [
        ...Object.keys(releasePackage.dependencies),
        ...Object.keys(releasePackage.peerDependencies)
      ]
        .filter((name) => name.startsWith('@asyra/'))
        .filter((name, index, values) => values.indexOf(name) === index)
        .sort(),
      license: releasePackage.license,
      manifestPath: releasePackage.manifestPath,
      name: releasePackage.name,
      publicEntries: publicEntriesFor(releasePackage.exports),
      version: releasePackage.version
    }
  })

  return freeze({
    authority: DOCUMENTATION_AUTHORITY,
    packages,
    release: {
      family: releaseFamily,
      packageCount: packages.length,
      publicationAuthorized: false,
      runtime: {
        node: rootManifest.engines.node,
        packageManager: rootManifest.packageManager
      },
      status: 'CANDIDATE',
      supportContract: SUPPORT_CONTRACT
    },
    schemaVersion: 1
  })
}
