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
  async function copyDirRecursive(src, dest, options = {}) {
    const { includeDotfiles = true } = options

    try {
      await fs.promises.mkdir(dest, { recursive: true })

      const entries = await fs.promises.readdir(src, { withFileTypes: true })

      for (const entry of entries) {
        const srcPath = path.join(src, entry.name)
        const destPath = path.join(dest, entry.name)

        if (entry.isDirectory()) {
          await copyDirRecursive(srcPath, destPath, options)
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

  // 2️⃣ Explicitly copy .gitignore and .prettierrc if they exist
  const dotfiles = ['.gitignore', '.prettierrc']
  for (const dotfile of dotfiles) {
    const srcPath = path.join(templateDir, dotfile)
    const destPath = path.join(targetDir, dotfile)
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath)
    }
  }

  // 3️⃣ Create empty lockfile based on package manager
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

  console.log('\n🎉 Asra Design project is ready!\n')
  console.log('Next steps:')
  console.log(`  cd ${targetName}`)
  console.log('  yarn dev')
}

main()
