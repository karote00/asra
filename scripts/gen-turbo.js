import { fileURLToPath } from 'url'
import fs from 'fs'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const workspaceRoot = path.resolve(__dirname, '..')
const turboJsonPath = path.join(workspaceRoot, 'turbo.json')
const baseConfigPath = path.join(workspaceRoot, 'turbo.base.json')

const ignorePackages = ['create-app/*']

const getBuildTask = (packageName) => {
  const repoName = packageName.split('/').pop()
  return repoName === 'asyra-design' ? 'react:build' : `build:${repoName}`
}

// Scan all packages in the monorepo workspaces
function getWorkspacePackages() {
  const rootPkgJson = JSON.parse(
    fs.readFileSync(path.join(workspaceRoot, 'package.json'), 'utf-8')
  )
  const workspaces = rootPkgJson.workspaces
  const pkgs = []

  for (const pattern of workspaces) {
    if (ignorePackages.includes(pattern)) continue

    const baseDir = pattern.replace('/*', '')
    const dirs = fs.readdirSync(path.join(workspaceRoot, baseDir))

    for (const dir of dirs) {
      const pkgDir = path.join(workspaceRoot, baseDir, dir)
      const pkgJsonPath = path.join(pkgDir, 'package.json')
      if (!fs.existsSync(pkgJsonPath)) continue

      const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'))

      pkgs.push({
        name: pkgJson.name,
        dir: path.relative(workspaceRoot, pkgDir),
        scripts: pkgJson.scripts ?? {},
        dependencies: Object.keys({
          ...pkgJson.dependencies,
          ...pkgJson.devDependencies
        }).filter((dep) => dep.startsWith('@asyra/'))
      })
    }
  }
  return pkgs.sort((left, right) => left.name.localeCompare(right.name))
}

// Generate build task config for each package based on its dependencies
function generateTurboJson(packages) {
  const tasks = {}
  const packagesByName = new Map(packages.map((pkg) => [pkg.name, pkg]))

  for (const pkg of packages) {
    const buildCmd = getBuildTask(pkg.name)
    if (!pkg.scripts[buildCmd]) {
      throw new Error(`${pkg.name} must declare the canonical ${buildCmd} task`)
    }

    tasks[`${pkg.name}#${buildCmd}`] = {
      cache: false,
      outputs: ['dist/**'],
      dependsOn: pkg.dependencies.map((dep) => {
        const dependency = packagesByName.get(dep)
        if (!dependency) {
          throw new Error(`${pkg.name} references unknown workspace ${dep}`)
        }
        return `${dep}#${getBuildTask(dep)}`
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

  return turboConfig
}

const args = process.argv.slice(2)
if (args.length !== 1 || !['--write', '--check'].includes(args[0])) {
  console.error('Usage: node scripts/gen-turbo.js --write|--check')
  process.exit(1)
}

const packages = getWorkspacePackages()
const generated = `${JSON.stringify(generateTurboJson(packages), null, 2)}\n`

if (args[0] === '--write') {
  fs.writeFileSync(turboJsonPath, generated)
  console.log('turbo.json generated')
} else {
  const current = fs.existsSync(turboJsonPath)
    ? fs.readFileSync(turboJsonPath, 'utf8')
    : ''
  if (current !== generated) {
    console.error('turbo.json is stale; run yarn gen:turbo and commit it')
    process.exit(1)
  }
  console.log('turbo.json is synchronized')
}
