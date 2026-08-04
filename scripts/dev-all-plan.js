import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DEFAULT_REPO_ROOT = path.resolve(__dirname, '..')

export const createDevAllPlan = (packageNames) => ({
  devProcesses: packageNames.map((packageName) => ({
    dir: path.join('packages', packageName),
    cmd: 'yarn dev'
  })),
  app: {
    dir: 'apps/asyra-design',
    cmd: 'yarn react:start'
  }
})

export const readWorkspacePackageNames = async (
  repoRoot = DEFAULT_REPO_ROOT
) => {
  const packagesDir = path.resolve(repoRoot, 'packages')
  const dirs = await fs.readdir(packagesDir, { withFileTypes: true })
  const packageNames = dirs
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
    .sort()

  await Promise.all(
    packageNames.map(async (packageName) => {
      const manifestPath = path.join(packagesDir, packageName, 'package.json')
      JSON.parse(await fs.readFile(manifestPath, 'utf8'))
    })
  )
  return packageNames
}

export const createWorkspaceDevAllPlan = async (
  repoRoot = DEFAULT_REPO_ROOT
) => {
  const packageNames = await readWorkspacePackageNames(repoRoot)
  return createDevAllPlan(packageNames)
}
