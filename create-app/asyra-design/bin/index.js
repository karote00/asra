#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const inquirer = require('inquirer')

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
        validate: (input) => input ? true : 'Project name cannot be empty',
      },
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
      default: 'yarn',
    },
  ])

  console.log(`\n🚀 Creating project "${targetName}"...\n`)

  // 1️⃣ Copy template ONLY
  fs.mkdirSync(targetDir, { recursive: true })
  fs.cpSync(templateDir, targetDir, { recursive: true })

  // 2️⃣ Create empty lockfile based on package manager
  const lockfileMap = {
    yarn: 'yarn.lock',
    npm: 'package-lock.json',
    pnpm: 'pnpm-lock.yaml',
  }

  const lockfileName = lockfileMap[packageManager]
  const lockfilePath = path.join(targetDir, lockfileName)

  // Always create (or overwrite) an empty lockfile
  fs.writeFileSync(lockfilePath, '')

  console.log(`📝 Created empty ${lockfileName}`)

  // 3️⃣ Install dependencies
  try {
    console.log('📦 Installing dependencies...')
    const installCmd = {
      yarn: 'yarn install',
      npm: 'npm install',
      pnpm: 'pnpm install',
    }[packageManager]

    execSync(installCmd, { cwd: targetDir, stdio: 'inherit' })
  } catch (err) {
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
