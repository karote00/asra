#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import inquirer from 'inquirer'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function resolveTargetName(argv) {
  const args = argv.slice(2)
  if (args[0]?.startsWith('create-')) return args[1]
  return args[0]
}

async function main() {
  let targetName = resolveTargetName(process.argv)

  if (!targetName) {
    const answer = await inquirer.prompt([
      {
        type: 'input',
        name: 'projectName',
        message: 'Project name:',
        validate: (input) => (input ? true : 'Project name cannot be empty')
      }
    ])
    targetName = answer.projectName
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

  const { packageManager } = await inquirer.prompt([
    {
      type: 'list',
      name: 'packageManager',
      message: 'Choose a package manager',
      choices: ['yarn', 'npm', 'pnpm'],
      default: 'yarn'
    }
  ])

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
  try {
    console.log('📦 Installing dependencies...')
    const installCmd = {
      yarn: 'yarn install',
      npm: 'npm install',
      pnpm: 'pnpm install'
    }[packageManager]

    execSync(installCmd, { cwd: targetDir, stdio: 'inherit' })
  } catch {
    console.error('\n❌ Failed to install dependencies.')
    console.error('You can try manually:')
    console.error(`  cd ${targetName}`)
    console.error(`  ${packageManager} install`)
    process.exit(1)
  }

  console.log('\n🎉 Asyra Design project is ready!\n')
  console.log('Next steps:')
  console.log(`  cd ${targetName}`)
  console.log('  yarn dev')
}

main()
