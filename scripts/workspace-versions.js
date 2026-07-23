import fs from 'node:fs'
import path from 'node:path'

const WORKSPACE_DIRECTORIES = ['packages', 'apps']
const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies'
]

const readManifest = (manifestPath) =>
  JSON.parse(fs.readFileSync(manifestPath, 'utf8'))

const getManifestPaths = (rootDirectory) =>
  WORKSPACE_DIRECTORIES.flatMap((directory) => {
    const workspaceDirectory = path.join(rootDirectory, directory)
    if (!fs.existsSync(workspaceDirectory)) return []
    return fs
      .readdirSync(workspaceDirectory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(workspaceDirectory, entry.name, 'package.json'))
      .filter((manifestPath) => fs.existsSync(manifestPath))
  }).sort()

export const resolveWorkspaceDependencyRange = ({
  environment,
  dependencyVersion
}) => {
  if (environment === 'dev') return 'workspace:*'
  if (environment === 'prod') return `^${dependencyVersion}`
  throw new Error(`Unsupported workspace version environment: ${environment}`)
}

export const createWorkspaceVersionPlan = ({ rootDirectory, environment }) => {
  const manifestPaths = getManifestPaths(rootDirectory)
  const manifests = manifestPaths.map((manifestPath) => ({
    manifestPath,
    manifest: readManifest(manifestPath)
  }))
  const versions = new Map(
    manifests.map(({ manifest }) => [manifest.name, manifest.version])
  )

  return manifests.flatMap(({ manifestPath, manifest: sourceManifest }) => {
    const manifest = structuredClone(sourceManifest)
    const updates = []

    for (const field of DEPENDENCY_FIELDS) {
      const dependencies = manifest[field]
      if (!dependencies) continue

      for (const dependencyName of Object.keys(dependencies)) {
        const dependencyVersion = versions.get(dependencyName)
        if (!dependencyName.startsWith('@asyra/') || !dependencyVersion) {
          continue
        }
        const nextRange = resolveWorkspaceDependencyRange({
          environment,
          dependencyVersion
        })
        if (dependencies[dependencyName] === nextRange) continue
        dependencies[dependencyName] = nextRange
        updates.push(`${field}.${dependencyName} -> ${nextRange}`)
      }
    }

    return updates.length === 0
      ? []
      : [
          {
            packageName: manifest.name,
            manifestPath,
            manifest,
            updates
          }
        ]
  })
}

export const applyWorkspaceVersionPlan = (plan) => {
  for (const { manifestPath, manifest } of plan) {
    fs.writeFileSync(
      manifestPath,
      `${JSON.stringify(manifest, null, 2)}\n`,
      'utf8'
    )
  }
}
