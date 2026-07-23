import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import path from 'node:path'

const validationDirectoryPrefix = 'release-validation-'
const excludedDirectoryNames = new Set([
  '.git',
  '.turbo',
  '.vercel',
  'coverage',
  'dist',
  'node_modules',
  'playwright-report',
  'test-results',
  'tmp'
])

const isLocalEnvironmentOverride = (name) =>
  name === '.env.local' || /^\.env\..+\.local$/.test(name)

const shouldCopyPath = (sourceRoot, sourcePath) => {
  const relativePath = path.relative(sourceRoot, sourcePath)
  if (!relativePath) return true

  const pathSegments = relativePath.split(path.sep)
  if (pathSegments.some((segment) => excludedDirectoryNames.has(segment))) {
    return false
  }

  const name = path.basename(sourcePath)
  if (isLocalEnvironmentOverride(name)) return false
  if (name === '.DS_Store' || name.startsWith('.pnp.')) return false
  if (
    pathSegments[0] === '.yarn' &&
    ['cache', 'install-state.gz', 'unplugged'].includes(pathSegments[1])
  ) {
    return false
  }

  return true
}

export const createReleaseValidationWorkspace = ({
  sourceRoot,
  validationParent
}) => {
  const resolvedSourceRoot = path.resolve(sourceRoot)
  const resolvedValidationParent = path.resolve(validationParent)
  mkdirSync(resolvedValidationParent, { recursive: true })

  const validationRoot = mkdtempSync(
    path.join(resolvedValidationParent, validationDirectoryPrefix)
  )

  try {
    for (const entry of readdirSync(resolvedSourceRoot)) {
      const sourcePath = path.join(resolvedSourceRoot, entry)
      if (!shouldCopyPath(resolvedSourceRoot, sourcePath)) continue

      cpSync(sourcePath, path.join(validationRoot, entry), {
        recursive: true,
        filter: (nestedSourcePath) =>
          shouldCopyPath(resolvedSourceRoot, nestedSourcePath)
      })
    }
  } catch (error) {
    rmSync(validationRoot, { recursive: true, force: true })
    throw error
  }

  return validationRoot
}

export const removeReleaseValidationWorkspace = (
  validationRoot,
  validationParent
) => {
  const resolvedValidationRoot = path.resolve(validationRoot)
  const resolvedValidationParent = path.resolve(validationParent)
  const isDirectValidationChild =
    path.dirname(resolvedValidationRoot) === resolvedValidationParent &&
    path.basename(resolvedValidationRoot).startsWith(validationDirectoryPrefix)

  if (!isDirectValidationChild) {
    throw new Error(
      `Refusing to remove unexpected release validation path: ${resolvedValidationRoot}`
    )
  }

  rmSync(resolvedValidationRoot, { recursive: true, force: true })
}
