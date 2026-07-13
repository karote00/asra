import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DEFAULT_REPO_ROOT = path.resolve(__dirname, '..')
const WORKSPACE_SCOPE = '@asyra/'
const DESIGN_SYSTEM_PACKAGE = 'design-system'

export const createInitialBuildCommand = (packageName) =>
  packageName === DESIGN_SYSTEM_PACKAGE
    ? 'yarn build:design-system'
    : 'yarn exec tsc --pretty false'

export const createDevAllPlan = (packageNames) => ({
  initialBuilds: packageNames.map((packageName) => ({
    dir: path.join('packages', packageName),
    cmd: createInitialBuildCommand(packageName)
  })),
  devProcesses: packageNames.map((packageName) => ({
    dir: path.join('packages', packageName),
    cmd: 'yarn dev'
  })),
  app: {
    dir: 'apps/asyra-design',
    cmd: 'yarn react:start'
  }
})

const getManifestWorkspaceDeps = (manifest, packageNames) => {
  const workspacePackageNames = new Set(packageNames)
  const deps = {
    ...(manifest.dependencies ?? {}),
    ...(manifest.peerDependencies ?? {})
  }

  return Object.keys(deps)
    .filter((dependencyName) => dependencyName.startsWith(WORKSPACE_SCOPE))
    .map((dependencyName) => dependencyName.slice(WORKSPACE_SCOPE.length))
    .filter((dependencyName) => workspacePackageNames.has(dependencyName))
}

export const orderPackageNamesByWorkspaceDependencies = (
  packageNames,
  manifestsByPackageName
) => {
  const ordered = []
  const visiting = new Set()
  const visited = new Set()
  const packageNameSet = new Set(packageNames)

  const visit = (packageName) => {
    if (visited.has(packageName)) {
      return
    }
    if (visiting.has(packageName)) {
      throw new Error(
        `Workspace dependency cycle detected while planning dev:all: ${packageName}`
      )
    }
    visiting.add(packageName)

    const manifest = manifestsByPackageName.get(packageName)
    if (manifest) {
      for (const dependencyName of getManifestWorkspaceDeps(
        manifest,
        packageNames
      )) {
        if (packageNameSet.has(dependencyName)) {
          visit(dependencyName)
        }
      }
    }

    visiting.delete(packageName)
    visited.add(packageName)
    ordered.push(packageName)
  }

  for (const packageName of packageNames) {
    visit(packageName)
  }

  return ordered
}

export const readWorkspacePackageManifests = async (
  repoRoot = DEFAULT_REPO_ROOT
) => {
  const packagesDir = path.resolve(repoRoot, 'packages')
  const dirs = await fs.readdir(packagesDir, { withFileTypes: true })
  const manifestsByPackageName = new Map()

  for (const dirent of dirs) {
    if (!dirent.isDirectory()) {
      continue
    }
    const packageName = dirent.name
    const packageJsonPath = path.join(packagesDir, packageName, 'package.json')
    const manifest = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'))
    manifestsByPackageName.set(packageName, manifest)
  }

  return manifestsByPackageName
}

export const createWorkspaceDevAllPlan = async (
  repoRoot = DEFAULT_REPO_ROOT
) => {
  const manifestsByPackageName = await readWorkspacePackageManifests(repoRoot)
  const packageNames = [...manifestsByPackageName.keys()].sort()
  const orderedPackageNames = orderPackageNamesByWorkspaceDependencies(
    packageNames,
    manifestsByPackageName
  )

  return createDevAllPlan(orderedPackageNames)
}
