#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import inquirer from 'inquirer'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const supportedPackageManagers = ['yarn', 'npm', 'pnpm']

function parseArguments(argv) {
  const args = argv.slice(2)
  let packageManager
  let targetName

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === '--package-manager') {
      packageManager = args[index + 1]
      index += 1
      continue
    }
    if (argument?.startsWith('--package-manager=')) {
      packageManager = argument.slice('--package-manager='.length)
      continue
    }
    if (!argument?.startsWith('-') && targetName === undefined) {
      targetName = argument
    }
  }

  return { packageManager, targetName }
}

function isSafeTargetName(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value === value.trim() &&
    value !== '.' &&
    value !== '..' &&
    !path.isAbsolute(value) &&
    path.basename(value) === value &&
    !value.includes('/') &&
    !value.includes('\\')
  )
}

async function main() {
  let { packageManager, targetName } = parseArguments(process.argv)

  if (!targetName) {
    const answer = await inquirer.prompt([
      {
        type: 'input',
        name: 'projectName',
        message: 'Project name:',
        validate: (input) =>
          isSafeTargetName(input)
            ? true
            : 'Project name must be one directory name'
      }
    ])
    targetName = answer.projectName
  }

  if (!isSafeTargetName(targetName)) {
    console.error('❌ Project name must be one directory name.')
    process.exit(1)
  }
  if (
    packageManager !== undefined &&
    !supportedPackageManagers.includes(packageManager)
  ) {
    console.error(
      `❌ Unsupported package manager "${packageManager}". Choose yarn, npm, or pnpm.`
    )
    process.exit(1)
  }

  const cwd = process.cwd()
  const targetDir = path.resolve(cwd, targetName)
  const templateDir = path.resolve(__dirname, '../template')

  if (!fs.existsSync(templateDir)) {
    console.error(`❌ Template directory not found: ${templateDir}`)
    process.exit(1)
  }

  if (fs.existsSync(targetDir)) {
    console.error(`❌ Directory "${targetName}" already exists.`)
    process.exit(1)
  }

  if (!packageManager) {
    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'packageManager',
        message: 'Choose a package manager',
        choices: supportedPackageManagers,
        default: 'yarn'
      }
    ])
    packageManager = answer.packageManager
  }

  console.log(`\n🚀 Creating project "${targetName}"...\n`)

  // 1️⃣ Copy template ONLY
  async function copyDirRecursive(src, dest) {
    try {
      await fs.promises.mkdir(dest, { recursive: true })

      const entries = await fs.promises.readdir(src, { withFileTypes: true })

      for (const entry of entries) {
        const srcPath = path.join(src, entry.name)
        const destPath = path.join(dest, entry.name)

        if (entry.isDirectory()) {
          await copyDirRecursive(srcPath, destPath)
        } else {
          await fs.promises.copyFile(srcPath, destPath)
        }
      }
    } catch (err) {
      console.error(`Error copying ${src} to ${dest}:`, err)
      throw err
    }
  }

  await copyDirRecursive(templateDir, targetDir)

  // 2️⃣ Create .gitignore and .prettierrc (dotfiles are excluded from npm packages by default)
  const gitignoreContent = `# See https://help.github.com/articles/ignoring-files/ for more about ignoring files.

# dependencies
/node_modules
/.pnp
.pnp.js

# testing
/coverage
/test-results/
/playwright-report/
/playwright/.cache/

# production
/build
/dist

# misc
.DS_Store
.env.local
.env.development.local
.env.test.local
.env.production.local

npm-debug.log*
yarn-debug.log*
yarn-error.log*
`
  const prettierConfigContent = JSON.stringify(
    {
      useTabs: false,
      printWidth: 80,
      semi: false,
      singleQuote: true,
      tabWidth: 2,
      trailingComma: 'none'
    },
    null,
    2
  )

  fs.writeFileSync(path.join(targetDir, '.gitignore'), gitignoreContent)
  fs.writeFileSync(path.join(targetDir, '.prettierrc'), prettierConfigContent)
  console.log('✓ Created .gitignore and .prettierrc')

  // 4️⃣ Create empty lockfile based on package manager
  const lockfileMap = {
    yarn: 'yarn.lock',
    npm: 'package-lock.json',
    pnpm: 'pnpm-lock.yaml'
  }

  const lockfileName = lockfileMap[packageManager]
  const lockfilePath = path.join(targetDir, lockfileName)

  // Always create (or overwrite) an empty lockfile
  fs.writeFileSync(lockfilePath, '')

  console.log(`📝 Created empty ${lockfileName}`)

  // 4️⃣ Install dependencies
  const installArguments = {
    yarn: ['install', '--no-immutable'],
    npm: ['install'],
    pnpm: ['install', '--no-frozen-lockfile']
  }
  try {
    console.log('📦 Installing dependencies...')
    execFileSync(packageManager, installArguments[packageManager], {
      cwd: targetDir,
      stdio: 'inherit'
    })
  } catch {
    console.error('\n❌ Failed to install dependencies.')
    console.error('You can try manually:')
    console.error(`  cd ${targetName}`)
    console.error(`  ${packageManager} install`)
    process.exit(1)
  }

  console.log('\n🎉 Asyra Design project is ready!\n')
  const startCommand = {
    yarn: 'yarn react:start',
    npm: 'npm run react:start',
    pnpm: 'pnpm react:start'
  }[packageManager]
  console.log('Next steps:')
  console.log(`  cd ${targetName}`)
  console.log(`  ${startCommand}`)
  console.log('  Open http://localhost:3000/?fileId=my-design')
}

main()
