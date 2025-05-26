import { fileURLToPath } from 'url'
import fs from 'fs'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const workspaceRoot = path.resolve(__dirname, '..')
const turboJsonPath = path.join(workspaceRoot, 'turbo.json')
const baseConfigPath = path.join(workspaceRoot, 'turbo.base.json')

// Scan all packages in the monorepo workspaces
function getWorkspacePackages() {
  const rootPkgJson = JSON.parse(
    fs.readFileSync(path.join(workspaceRoot, 'package.json'), 'utf-8')
  )
  const workspaces = rootPkgJson.workspaces
  const pkgs = []

  for (const pattern of workspaces) {
    const baseDir = pattern.replace('/*', '')
    const dirs = fs.readdirSync(path.join(workspaceRoot, baseDir))

    for (const dir of dirs) {
      const pkgDir = path.join(workspaceRoot, baseDir, dir)
      const pkgJsonPath = path.join(pkgDir, 'package.json')
      if (!fs.existsSync(pkgJsonPath)) continue

      const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'))

      // Only keep internal monorepo dependencies
      const dependencies = Object.keys({
        ...pkgJson.dependencies,
        ...pkgJson.devDependencies
      }).filter((dep) => dep.startsWith('@asra/'))

      pkgs.push({
        name: pkgJson.name,
        dir: path.relative(workspaceRoot, pkgDir),
        dependencies
      })
    }
  }
  return pkgs
}

// Generate build task config for each package based on its dependencies
function generateTurboJson(packages) {
  const tasks = {}

  for (const pkg of packages) {
    const repoName = pkg.name.split('/').pop()
    const buildCmd = repoName === 'ui' ? 'react:build' : `build:${repoName}`

    tasks[buildCmd] = {
      cache: false,
      outputs: ['dist/**'],
      dependsOn: pkg.dependencies.map((dep) => {
        const depName = dep.split('/').pop()
        return `^build:${depName}`
      })
    }
  }

  // Merge base config with generated tasks
  const baseTurboConfig = fs.existsSync(baseConfigPath)
    ? JSON.parse(fs.readFileSync(baseConfigPath, 'utf-8'))
    : {}

  const turboConfig = {
    ...baseTurboConfig,
    tasks: {
      ...baseTurboConfig.tasks,
      ...tasks
    }
  }

  fs.writeFileSync(turboJsonPath, JSON.stringify(turboConfig, null, 2))
  console.log('✅ turbo.json has been generated')
}

// Main entry
const packages = getWorkspacePackages()
generateTurboJson(packages)
