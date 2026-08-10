import fs from 'node:fs'
import path from 'node:path'

import { readFrameworkReleaseSource } from '../framework-release-packages.js'

const SUPPORT_CONTRACT = 'docs/ai/framework/RELEASE_SUPPORT.md'
const ARTIFACT_DIRECTORY = 'tmp/framework-release-artifacts'

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

const artifactNameFor = ({ name, version }) =>
  `${name.slice(1).replace('/', '-')}-${version}.tgz`

export const readApprovedExamplePackageInputs = ({ repositoryRoot }) => {
  const resolvedRoot = path.resolve(repositoryRoot)
  const releaseSource = readFrameworkReleaseSource({
    repositoryRoot: resolvedRoot
  })
  const rootManifest = JSON.parse(
    fs.readFileSync(path.join(resolvedRoot, 'package.json'), 'utf8')
  )
  const families = new Set(
    releaseSource.packages.map(({ version }) =>
      version.split('.').slice(0, 2).join('.')
    )
  )
  if (families.size !== 1) {
    throw new Error(
      `Executable examples require one Framework release family, found ${[
        ...families
      ].join(', ')}`
    )
  }
  const [releaseFamily] = families
  const packages = releaseSource.packages.map((record) => ({
    name: record.name,
    version: record.version,
    manifestPath: record.manifestPath,
    artifactPackageName: record.name,
    artifactPath: path.posix.join(ARTIFACT_DIRECTORY, artifactNameFor(record)),
    publicEntries: publicEntriesFor(record.exports)
  }))

  return freeze({
    status: 'CANDIDATE',
    publicationAuthorized: false,
    releaseFamily,
    runtime: {
      node: rootManifest.engines.node,
      packageManager: rootManifest.packageManager
    },
    supportContract: SUPPORT_CONTRACT,
    packages
  })
}
