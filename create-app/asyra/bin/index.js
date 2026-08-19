#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import inquirer from 'inquirer'

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))

const parseArguments = (argv) => {
  const args = argv.slice(2)
  if (args.length > 1 || args.some((argument) => argument.startsWith('-'))) {
    console.error('❌ Usage: npx create-asyra-app [project-name]')
    process.exit(1)
  }
  return args[0]
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
  let targetName = parseArguments(process.argv)

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

  console.log(`\n🚀 Creating project "${targetName}"...\n`)
  await copyDirectory(templateDirectory, targetDirectory)

  const packageManagerVersion = execFileSync('yarn', ['--version'], {
    encoding: 'utf8'
  }).trim()
  const projectManifestPath = path.join(targetDirectory, 'package.json')
  const projectManifest = JSON.parse(
    fs.readFileSync(projectManifestPath, 'utf8')
  )
  projectManifest.packageManager = `yarn@${packageManagerVersion}`
  fs.writeFileSync(
    projectManifestPath,
    `${JSON.stringify(projectManifest, null, 2)}\n`
  )

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
  fs.writeFileSync(
    path.join(targetDirectory, '.yarnrc.yml'),
    'nodeLinker: node-modules\n'
  )
  fs.writeFileSync(path.join(targetDirectory, 'yarn.lock'), '')

  try {
    console.log('📦 Installing dependencies...')
    execFileSync('yarn', ['install', '--no-immutable'], {
      cwd: targetDirectory,
      stdio: 'inherit'
    })
  } catch {
    console.error('\n❌ Failed to install dependencies.')
    console.error('You can try manually:')
    console.error(`  cd ${targetName}`)
    console.error('  yarn install')
    process.exit(1)
  }

  console.log('\n🎉 Asyra Framework project is ready!\n')
  console.log('Next steps:')
  console.log(`  cd ${targetName}`)
  console.log('  yarn start')
  console.log('  Open http://localhost:3000')
}

void main()
