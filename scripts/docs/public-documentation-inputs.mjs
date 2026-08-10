import path from 'node:path'

import { readFrameworkReleaseSource } from '../framework-release-packages.js'
import { readApprovedExamplePackageInputs } from '../release/example-package-inputs.mjs'
import { checkExampleInventory } from './example-inventory.mjs'

const AUTHORITY = {
  allowedRoots: [
    'apps/asyra-design/',
    'create-app/asyra-design/',
    'docs/ai/apps/asyra-design/',
    'docs/ai/framework/',
    'docs/examples/',
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
  const packageInputs = readApprovedExamplePackageInputs({
    repositoryRoot: root
  })
  const exampleInventory = await checkExampleInventory({
    repositoryRoot: root
  })
  const examplePackagesByName = new Map(
    packageInputs.packages.map((record) => [record.name, record])
  )

  const packages = releaseSource.packages.map((releasePackage) => {
    const examplePackage = examplePackagesByName.get(releasePackage.name)
    if (!examplePackage) {
      throw new Error(
        `Documentation input is missing ${releasePackage.name} from the approved example package inventory`
      )
    }
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
      publicEntries: examplePackage.publicEntries,
      version: releasePackage.version
    }
  })

  const examples = exampleInventory.examples.map((example) => ({
    environment: example.environment,
    expectedResult: example.expectedResult,
    id: example.id,
    objective: example.objective,
    ownership: example.ownership,
    publicPackages: example.publicPackages.map(({ name }) => name),
    runCommand: example.runCommand,
    snippetSha256: example.snippetSha256,
    source: example.source,
    sourceRegion: example.sourceRegion,
    title: example.title
  }))

  return freeze({
    authority: DOCUMENTATION_AUTHORITY,
    examples,
    packages,
    release: {
      family: packageInputs.releaseFamily,
      packageCount: packages.length,
      publicationAuthorized: packageInputs.publicationAuthorized,
      runtime: packageInputs.runtime,
      status: packageInputs.status,
      supportContract: packageInputs.supportContract
    },
    schemaVersion: 1
  })
}
