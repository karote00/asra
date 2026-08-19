#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import inquirer from 'inquirer'

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const supportedPackageManagers = ['yarn', 'npm', 'pnpm']

const parseArguments = (argv) => {
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

const isSafeTargetName = (value) =>
  typeof value === 'string' &&
  value.length > 0 &&
  value === value.trim() &&
  value !== '.' &&
  value !== '..' &&
  !path.isAbsolute(value) &&
  path.basename(value) === value &&
  !value.includes('/') &&
  !value.includes('\\')

const copyDirectory = async (source, destination) => {
  await fs.promises.mkdir(destination, { recursive: true })
  const entries = await fs.promises.readdir(source, { withFileTypes: true })

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name)
    const destinationPath = path.join(destination, entry.name)
    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, destinationPath)
    } else {
      await fs.promises.copyFile(sourcePath, destinationPath)
    }
  }
}

const main = async () => {
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

  const targetDirectory = path.resolve(process.cwd(), targetName)
  const templateDirectory = path.resolve(currentDirectory, '../template')

  if (!fs.existsSync(templateDirectory)) {
    console.error(`❌ Template directory not found: ${templateDirectory}`)
    process.exit(1)
  }
  if (fs.existsSync(targetDirectory)) {
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
  await copyDirectory(templateDirectory, targetDirectory)

  const gitignoreContent = `# dependencies
/node_modules
/.pnp
.pnp.js

# testing
/coverage
/test-results
/playwright-report

# production
/dist

# local
.DS_Store
.env.local
.env.development.local
.env.test.local
.env.production.local
npm-debug.log*
yarn-debug.log*
yarn-error.log*
`
  const prettierConfig = {
    useTabs: false,
    printWidth: 80,
    semi: false,
    singleQuote: true,
    tabWidth: 2,
    trailingComma: 'none'
  }
  fs.writeFileSync(path.join(targetDirectory, '.gitignore'), gitignoreContent)
  fs.writeFileSync(
    path.join(targetDirectory, '.prettierrc'),
    JSON.stringify(prettierConfig, null, 2)
  )
  if (packageManager === 'yarn') {
    fs.writeFileSync(
      path.join(targetDirectory, '.yarnrc.yml'),
      'nodeLinker: node-modules\n'
    )
  }

  const lockfileNames = {
    yarn: 'yarn.lock',
    npm: 'package-lock.json',
    pnpm: 'pnpm-lock.yaml'
  }
  fs.writeFileSync(
    path.join(targetDirectory, lockfileNames[packageManager]),
    ''
  )

  const installArguments = {
    yarn: ['install', '--no-immutable'],
    npm: ['install'],
    pnpm: ['install', '--no-frozen-lockfile']
  }
  const installCommand = {
    yarn: 'yarn install',
    npm: 'npm install',
    pnpm: 'pnpm install'
  }[packageManager]

  try {
    console.log('📦 Installing dependencies...')
    execFileSync(packageManager, installArguments[packageManager], {
      cwd: targetDirectory,
      stdio: 'inherit'
    })
  } catch {
    console.error('\n❌ Failed to install dependencies.')
    console.error('You can try manually:')
    console.error(`  cd ${targetName}`)
    console.error(`  ${installCommand}`)
    process.exit(1)
  }

  const startCommand = {
    yarn: 'yarn start',
    npm: 'npm run start',
    pnpm: 'pnpm start'
  }[packageManager]
  console.log('\n🎉 Asyra Framework project is ready!\n')
  console.log('Next steps:')
  console.log(`  cd ${targetName}`)
  console.log(`  ${startCommand}`)
  console.log('  Open http://localhost:3000')
}

void main()
