#!/usr/bin/env node
/**
 * release-template.js
 *
 * Usage:
 *   yarn release --prod=asyra-design
 *   yarn release --prod=whiteboard
 *   yarn release --prod=asyra-design --verbose
 *
 * Features:
 *   - Read config for each app
 *   - Copy source files to release template folder
 *   - Clean unnecessary files (lock files, node_modules, .env, etc.)
 *   - Copy index.html
 *   - Update @asyra/* dependencies to fixed versions from packages/
 *   - Add standard devDependencies (ESLint, Prettier, etc.)
 *   - Copy root ESLint/Prettier config
 *   - Copy prod app .gitignore
 *   - Optional verbose output
 */

import fs from 'fs'
import path from 'path'
import fse from 'fs-extra'
import { sync as globSync } from 'glob'

// ----------------------
// Parse CLI arguments
// ----------------------
const args = process.argv.slice(2)
let APP_NAME = 'asyra-design'
let VERBOSE = false
let CHECK = false

for (const arg of args) {
  if (arg.startsWith('--prod=')) {
    APP_NAME = arg.split('=')[1]
  } else if (arg === '--verbose') {
    VERBOSE = true
  } else if (arg === '--check') {
    CHECK = true
  } else {
    console.error(`Unknown argument: ${arg}`)
    process.exit(1)
  }
}

// ----------------------
// Load config JSON
// ----------------------
const CONFIG_FILE = path.resolve(`release-configs/${APP_NAME}.json`)
if (!fs.existsSync(CONFIG_FILE)) {
  console.error(`Config file ${CONFIG_FILE} not found!`)
  process.exit(1)
}

const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'))
const SRC_DIR = path.resolve(config.src)
const CONFIGURED_DEST_DIR = path.resolve(config.dest)
const CHECK_DIRECTORY = path.resolve(
  'tmp',
  `release-template-check-${APP_NAME}-${process.pid}`
)
const DEST_DIR = CHECK ? CHECK_DIRECTORY : CONFIGURED_DEST_DIR
const CLEAN_FILES = config.cleanFiles || []
const GENERATED_ENVIRONMENT = config.environment || {}
const TEMPLATE_README = config.readme ? path.resolve(config.readme) : undefined
const TEMPLATE_LICENSE = config.license
  ? path.resolve(config.license)
  : undefined

if (CHECK) {
  process.on('exit', () => {
    fse.removeSync(CHECK_DIRECTORY)
  })
}

console.log(`Releasing "${APP_NAME}"`)
console.log(`SRC_DIR: ${SRC_DIR}`)
console.log(`DEST_DIR: ${DEST_DIR}`)
console.log(`Files/folders to clean: ${CLEAN_FILES.join(', ')}`)

// ----------------------
// Remove old template
// ----------------------
if (fs.existsSync(DEST_DIR)) {
  if (VERBOSE) console.log(`Cleaning old template at ${DEST_DIR}...`)
  fse.removeSync(DEST_DIR)
}
fse.mkdirpSync(DEST_DIR)

// ----------------------
// Copy source files
// ----------------------
if (VERBOSE) console.log('Copying files...')
fse.copySync(SRC_DIR, DEST_DIR, {
  filter: (src) => {
    const relPath = path.relative(SRC_DIR, src)
    if (relPath === 'CHANGELOG.md') return false // skip changelog
    return true
  }
})

// ----------------------
// Remove unnecessary files
// ----------------------
if (VERBOSE) console.log('Removing unnecessary files...')
for (const pattern of CLEAN_FILES) {
  const files = globSync(`${DEST_DIR}/**/${pattern}`, {
    nodir: true,
    dot: true
  })
  for (const file of files) {
    fs.unlinkSync(file)
    if (VERBOSE) console.log(`Deleted file: ${file}`)
  }

  const dirs = globSync(`${DEST_DIR}/**/${pattern}`, {
    onlyDirectories: true,
    dot: true
  })
  for (const dir of dirs) {
    fse.removeSync(dir)
    if (VERBOSE) console.log(`Deleted dir: ${dir}`)
  }
}

const generatedEnvironmentPath = path.join(DEST_DIR, '.env')
fs.writeFileSync(
  generatedEnvironmentPath,
  `${Object.entries(GENERATED_ENVIRONMENT)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')}\n`
)
if (VERBOSE) console.log('Created standalone public environment defaults')

if (TEMPLATE_README) {
  const relativeReadmeSource = path.relative(SRC_DIR, TEMPLATE_README)
  if (
    relativeReadmeSource.startsWith('..') ||
    path.isAbsolute(relativeReadmeSource) ||
    !fs.existsSync(TEMPLATE_README)
  ) {
    throw new Error('Template README must be an existing app source file')
  }
  fse.copySync(TEMPLATE_README, path.join(DEST_DIR, 'README.md'))
  const copiedReadmeSource = path.join(DEST_DIR, relativeReadmeSource)
  if (copiedReadmeSource !== path.join(DEST_DIR, 'README.md')) {
    fse.removeSync(copiedReadmeSource)
  }
  if (VERBOSE) console.log('Created standalone template README')
}

if (TEMPLATE_LICENSE) {
  if (!fs.existsSync(TEMPLATE_LICENSE)) {
    throw new Error('Template license must be an existing file')
  }
  fse.copySync(TEMPLATE_LICENSE, path.join(DEST_DIR, 'LICENSE'))
  if (VERBOSE) console.log('Created standalone template license')
}

// ----------------------
// Copy prod app index.html
// ----------------------
const indexHtmlSrc = path.join(SRC_DIR, 'index.html')
const indexHtmlDest = path.join(DEST_DIR, 'index.html')
if (fs.existsSync(indexHtmlSrc)) {
  fse.copySync(indexHtmlSrc, indexHtmlDest)
  if (VERBOSE) console.log('Copied index.html to template')
} else {
  console.warn(`index.html not found in ${SRC_DIR}, Vite app may fail to start`)
}

// ----------------------
// Update @asyra/* dependencies
// ----------------------
if (VERBOSE) console.log('Updating @asyra/* dependencies...')
const pkgPath = path.join(DEST_DIR, 'package.json')

if (!fs.existsSync(pkgPath)) {
  console.warn(
    `No package.json found at ${pkgPath}, skipping dependency update`
  )
} else {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
  const packagesDir = path.resolve('packages')

  function updateDeps(deps) {
    if (!deps) return
    for (const depName of Object.keys(deps)) {
      if (depName.startsWith('@asyra/')) {
        const localPkgPath = path.join(
          packagesDir,
          depName.replace('@asyra/', ''),
          'package.json'
        )
        if (fs.existsSync(localPkgPath)) {
          const localPkg = JSON.parse(fs.readFileSync(localPkgPath, 'utf-8'))
          deps[depName] = localPkg.version
          if (VERBOSE) console.log(`Set ${depName} => ${localPkg.version}`)
        }
      }
    }
  }

  updateDeps(pkg.dependencies)
  updateDeps(pkg.devDependencies)
  updateDeps(pkg.peerDependencies)

  pkg.engines = {
    node: '24.x'
  }
  pkg.packageManager = 'yarn@4.3.1'

  if (pkg.scripts) {
    pkg.scripts['build:collaboration-server'] =
      'tsc -p tsconfig.collaboration-server.json && vite build --config vite.collaboration-server.config.ts'
    pkg.scripts['build:document-backend'] =
      'tsc -p tsconfig.document-backend.json && vite build --config vite.document-backend.config.ts'
    delete pkg.scripts['generate:crdt-7076-document']
  }

  // ----------------------
  // Add ESLint v9 flat config packages
  // ----------------------
  const eslintFlatPackages = {
    '@eslint/compat': '^2.0.1',
    '@eslint/js': '^9.39.2',
    eslint: '^9.39.2',
    'eslint-config-prettier': '^10.1.8',
    'eslint-plugin-prettier': '^5.5.5',
    'eslint-plugin-react': '^7.37.5',
    prettier: '^3.4.2',
    'typescript-eslint': '^8.54.0'
  }
  pkg.devDependencies = pkg.devDependencies || {}
  Object.assign(pkg.devDependencies, eslintFlatPackages)
  if (VERBOSE) console.log('Added ESLint v9 flat config devDependencies')

  // ----------------------
  // Remove old eslintConfig (react-app) if present
  // ----------------------
  if (pkg.eslintConfig) {
    delete pkg.eslintConfig
    if (VERBOSE) console.log('Removed old eslintConfig (react-app)')
  }

  // ----------------------
  // Remove vite-plugin-vercel from devDependencies
  // ----------------------
  if (pkg.devDependencies?.['vite-plugin-vercel']) {
    delete pkg.devDependencies['vite-plugin-vercel']
    if (VERBOSE) console.log('Removed vite-plugin-vercel from devDependencies')
  }

  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2))
  if (VERBOSE) console.log('package.json updated ✅')
}

// ----------------------
// Fix vite.config.ts outDir and remove Vercel config
// ----------------------
const viteConfigPath = path.join(DEST_DIR, 'vite.config.ts')
if (fs.existsSync(viteConfigPath)) {
  let viteConfigContent = fs.readFileSync(viteConfigPath, 'utf-8')
  const originalConfig = viteConfigContent

  // Change outDir from '../../dist' to 'dist'
  viteConfigContent = viteConfigContent.replace(
    /outDir:\s*'.*\/dist'/g,
    "outDir: 'dist'"
  )

  // Remove vercel import
  viteConfigContent = viteConfigContent.replace(
    /import\s+vercel\s+from\s+['"]vite-plugin-vercel['"]\s*\n/,
    ''
  )

  // Remove vercel plugin from plugins array
  viteConfigContent = viteConfigContent.replace(/vercel\(\)(?:,\s*)?/g, '')

  // Clean up any duplicate commas after removing elements
  viteConfigContent = viteConfigContent.replace(/,(\s*[}\]])/g, '$1')

  // Fix top-level property indentation after plugin removal.
  // A top-level property with wrong indent will have: 4 spaces, followed by lines with <= 4 spaces (not children)
  const lines = viteConfigContent.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // Check if this is a property line opening an object
    if (trimmed.match(/^[a-z]+\s*:\s*\{/)) {
      const leadingSpaces = (line.match(/^\s*/)[0] || '').length

      // If it has 4 spaces, check if it should be 2 (top-level property)
      if (leadingSpaces === 4) {
        // Check next few lines to see if they're children (more indented) or siblings (same/less indented)
        let hasChildren = false
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          const nextLine = lines[j]
          const nextSpaces = (nextLine.match(/^\s*/)[0] || '').length
          const nextTrimmed = nextLine.trim()

          // Skip empty lines
          if (!nextTrimmed) continue

          // If next non-empty line has MORE indentation, this is a parent with children
          if (nextSpaces > 4) {
            hasChildren = true
            break
          }

          // If next non-empty line has SAME or LESS indentation, this is a sibling
          break
        }

        // If no children found, this is likely a top-level property with wrong indent
        if (!hasChildren) {
          lines[i] = '  ' + trimmed
        }
      }
    }
  }
  viteConfigContent = lines.join('\n')

  if (viteConfigContent !== originalConfig) {
    fs.writeFileSync(viteConfigPath, viteConfigContent)
    if (VERBOSE)
      console.log('Fixed vite.config.ts: removed Vercel config and set outDir')
  } else if (VERBOSE) {
    console.log('vite.config.ts already configured correctly')
  }
}

// ----------------------
// Remove .vercel directory
// ----------------------
const vercelDir = path.join(DEST_DIR, '.vercel')
if (fs.existsSync(vercelDir)) {
  fse.removeSync(vercelDir)
  if (VERBOSE) console.log('Removed .vercel directory')
}

// ----------------------
// Create standalone ESLint config
// ----------------------
const eslintConfigDest = path.join(DEST_DIR, 'eslint.config.js')
const eslintConfigContent = `/* eslint-env node */

import { includeIgnoreFile } from '@eslint/compat'
import tseslint from 'typescript-eslint'
import js from '@eslint/js'
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended'
import react from 'eslint-plugin-react'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const gitignorePath = path.resolve(__dirname, '.gitignore')

export default tseslint.config(
  js.configs.recommended,
  includeIgnoreFile(gitignorePath),
  tseslint.configs.recommended,
  tseslint.configs.strict,
  tseslint.configs.stylistic,
  eslintPluginPrettierRecommended,
  {
    rules: {
      'no-nested-ternary': 'error'
    }
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      react
    },
    rules: {
      'no-console': 'warn',
      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error',
      '@typescript-eslint/no-empty-object-type': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-useless-constructor': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          vars: 'all',
          args: 'none',
          varsIgnorePattern: '^_',
          argsIgnorePattern: '^_',
          ignoreRestSiblings: true,
          caughtErrors: 'none'
        }
      ],
      '@typescript-eslint/consistent-generic-constructors': 'off',
      '@typescript-eslint/no-inferrable-types': [
        'error',
        {
          ignoreProperties: true
        }
      ]
    }
  }
)
`

fs.writeFileSync(eslintConfigDest, eslintConfigContent)
if (VERBOSE) console.log('Created eslint.config.js for template')

// ----------------------
// Copy root Prettier config
// ----------------------
const prettierConfig = '.prettierrc'
const srcPrettier = path.resolve(prettierConfig)
const destPrettier = path.join(DEST_DIR, prettierConfig)
if (fs.existsSync(srcPrettier)) {
  fse.copySync(srcPrettier, destPrettier)
  if (VERBOSE) console.log(`Copied ${prettierConfig} to template`)
}

// ----------------------
// Copy prod app .gitignore
// ----------------------
const gitignoreSrc = path.join(SRC_DIR, '.gitignore')
const gitignoreDest = path.join(DEST_DIR, '.gitignore')
if (fs.existsSync(gitignoreSrc)) {
  fse.copySync(gitignoreSrc, gitignoreDest)
  if (VERBOSE) console.log('Copied .gitignore to template')
}

const IGNORED_COMPARISON_DIRECTORIES = new Set([
  '.turbo',
  'coverage',
  'dist',
  'node_modules',
  'playwright-report',
  'test-results'
])

const isIgnoredComparisonDirectory = (name) =>
  IGNORED_COMPARISON_DIRECTORIES.has(name) || /^\..+-data$/u.test(name)

const collectFiles = (directory, prefix = '') => {
  if (!fs.existsSync(directory)) return new Map()
  const files = new Map()

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && isIgnoredComparisonDirectory(entry.name)) {
      continue
    }
    const relativePath = path.join(prefix, entry.name)
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      for (const [nestedPath, value] of collectFiles(entryPath, relativePath)) {
        files.set(nestedPath, value)
      }
    } else {
      files.set(relativePath, fs.readFileSync(entryPath))
    }
  }

  return files
}

if (CHECK) {
  const expectedFiles = collectFiles(DEST_DIR)
  const committedFiles = collectFiles(CONFIGURED_DEST_DIR)
  const paths = new Set([...expectedFiles.keys(), ...committedFiles.keys()])
  const differences = [...paths].sort().filter((relativePath) => {
    const expected = expectedFiles.get(relativePath)
    const committed = committedFiles.get(relativePath)
    return !expected || !committed || !expected.equals(committed)
  })

  if (differences.length > 0) {
    console.error(
      `Generated template is stale (${differences.length} differing files):\n${differences
        .slice(0, 30)
        .map((file) => `- ${file}`)
        .join('\n')}`
    )
    process.exitCode = 1
  } else {
    console.log(`Generated template for "${APP_NAME}" is synchronized`)
  }
} else {
  console.log(`Release of "${APP_NAME}" finished!`)
}
