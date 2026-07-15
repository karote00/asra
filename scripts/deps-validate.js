#!/usr/bin/env node
/**
 * Validate internal monorepo dependencies from actual source imports.
 *
 * Usage:
 *   yarn deps:validate
 *   yarn deps:validate --verbose
 */

import fs from 'fs'
import path from 'path'
import process from 'process'
import { fileURLToPath } from 'url'
import { glob } from 'glob'
import ts from 'typescript'

const INTERNAL_SCOPE = '@asyra/'
const SOURCE_GLOB = '**/*.{ts,tsx,js,jsx}'

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

function sourceFileKind(filePath) {
  if (filePath.endsWith('.tsx')) return ts.ScriptKind.TSX
  if (filePath.endsWith('.jsx')) return ts.ScriptKind.JSX
  if (filePath.endsWith('.js')) return ts.ScriptKind.JS
  return ts.ScriptKind.TS
}

function moduleSpecifierText(node) {
  return node && ts.isStringLiteralLike(node) ? node.text : undefined
}

export function extractInternalImports(source, filePath) {
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    sourceFileKind(filePath)
  )
  const imports = []

  function addImport(specifier) {
    if (specifier?.startsWith(INTERNAL_SCOPE)) imports.push(specifier)
  }

  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      addImport(moduleSpecifierText(node.moduleSpecifier))
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      addImport(moduleSpecifierText(node.moduleReference.expression))
    } else if (ts.isCallExpression(node) && node.arguments.length === 1) {
      const isRequire =
        ts.isIdentifier(node.expression) && node.expression.text === 'require'
      const isDynamicImport =
        node.expression.kind === ts.SyntaxKind.ImportKeyword

      if (isRequire || isDynamicImport) {
        addImport(moduleSpecifierText(node.arguments[0]))
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return imports
}

export function resolveWorkspaceImport(importedPackage, workspaceNames) {
  let owner

  for (const workspaceName of workspaceNames) {
    const ownsImport =
      importedPackage === workspaceName ||
      importedPackage.startsWith(`${workspaceName}/`)

    if (ownsImport && (!owner || workspaceName.length > owner.length)) {
      owner = workspaceName
    }
  }

  return owner
}

function isTestFile(relativeFile) {
  const normalized = relativeFile.replaceAll('\\', '/')
  return (
    /(^|\/)__(tests|mocks)__(\/|$)/.test(normalized) ||
    /\.(test|spec)\.[cm]?[jt]sx?$/.test(normalized)
  )
}

export function validateSourceImports({
  workspaceName,
  relativeFile,
  source,
  dependencies,
  devDependencies,
  workspaceNames
}) {
  const declaredDependencies = new Set(dependencies)
  if (isTestFile(relativeFile)) {
    for (const dependency of devDependencies) {
      declaredDependencies.add(dependency)
    }
  }

  const missing = new Set()
  for (const importedPackage of extractInternalImports(source, relativeFile)) {
    const owner = resolveWorkspaceImport(importedPackage, workspaceNames)

    if (owner === workspaceName) continue
    if (!owner || !declaredDependencies.has(owner)) {
      missing.add(owner ?? importedPackage)
    }
  }

  return [...missing]
}

function addMissingDependency(
  missingDependencies,
  workspaceName,
  dependency,
  file
) {
  if (!missingDependencies.has(workspaceName)) {
    missingDependencies.set(workspaceName, new Map())
  }

  const dependencies = missingDependencies.get(workspaceName)
  if (!dependencies.has(dependency)) {
    dependencies.set(dependency, new Set())
  }
  dependencies.get(dependency).add(file)
}

export async function validateDependencies({
  rootDir = process.cwd(),
  verbose = false
} = {}) {
  const packagesDir = path.join(rootDir, 'packages')
  if (!fs.existsSync(packagesDir)) {
    return {
      workspaces: [],
      selfDependencies: [],
      missingDependencies: new Map(),
      setupError: 'packages/ directory not found'
    }
  }

  const workspaceDirs = fs
    .readdirSync(packagesDir)
    .map((name) => path.join(packagesDir, name))
    .filter((directory) => fs.existsSync(path.join(directory, 'package.json')))
  const workspaces = workspaceDirs.map((directory) => {
    const manifest = readJSON(path.join(directory, 'package.json'))
    return {
      name: manifest.name,
      directory,
      dependencies: Object.keys(manifest.dependencies || {}),
      devDependencies: Object.keys(manifest.devDependencies || {})
    }
  })
  const workspaceNames = new Set(workspaces.map(({ name }) => name))
  const selfDependencies = workspaces
    .filter(
      ({ name, dependencies, devDependencies }) =>
        dependencies.includes(name) || devDependencies.includes(name)
    )
    .map(({ name }) => name)
  const missingDependencies = new Map()

  if (verbose) console.log(`Found ${workspaces.length} workspaces`)

  for (const workspace of workspaces) {
    if (verbose) console.log(`\nScanning ${workspace.name}`)

    const files = await glob(SOURCE_GLOB, {
      cwd: workspace.directory,
      absolute: true,
      ignore: ['**/node_modules/**', '**/dist/**']
    })

    for (const file of files.sort()) {
      const relativeFile = path.relative(workspace.directory, file)
      const source = fs.readFileSync(file, 'utf-8')
      const missing = validateSourceImports({
        workspaceName: workspace.name,
        relativeFile,
        source,
        dependencies: workspace.dependencies,
        devDependencies: workspace.devDependencies,
        workspaceNames
      })

      for (const dependency of missing) {
        addMissingDependency(
          missingDependencies,
          workspace.name,
          dependency,
          relativeFile
        )
      }
    }
  }

  return {
    workspaces,
    selfDependencies,
    missingDependencies,
    setupError: undefined
  }
}

function reportValidation(result) {
  if (result.setupError) {
    console.error(`✖ ${result.setupError}`)
    return false
  }

  if (result.selfDependencies.length > 0) {
    console.error('\n✖ Invalid dependency configuration\n')
    for (const name of result.selfDependencies) {
      console.error(`- ${name} depends on itself`)
    }
    console.error('\nThis is always invalid in a monorepo.')
    return false
  }

  if (result.missingDependencies.size === 0) {
    console.log('✔ Dependency validation passed\n')
    console.log(`Workspaces scanned: ${result.workspaces.length}`)
    console.log('No missing internal dependencies found.')
    return true
  }

  console.error('\n✖ Dependency validation failed\n')
  console.error('Missing internal dependencies detected:\n')

  for (const [workspaceName, dependencies] of result.missingDependencies) {
    console.error(`- ${workspaceName}`)
    for (const [dependency, files] of dependencies) {
      console.error(`  → missing dependency: ${dependency}`)
      for (const file of files) {
        console.error(`    - ${file}`)
      }
    }
    console.error('')
  }

  return false
}

export async function main(args = process.argv.slice(2)) {
  const result = await validateDependencies({
    verbose: args.includes('--verbose')
  })
  return reportValidation(result) ? 0 : 1
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : undefined
if (invokedPath === fileURLToPath(import.meta.url)) {
  process.exitCode = await main()
}
