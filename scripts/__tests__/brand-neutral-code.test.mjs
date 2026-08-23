import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
)
const sourceExtensions = new Set([
  '.cjs',
  '.css',
  '.html',
  '.js',
  '.json',
  '.mjs',
  '.sh',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml'
])
const ignoredDirectories = new Set([
  '.git',
  '.turbo',
  '.vercel',
  '.yarn',
  'coverage',
  'dist',
  'docs',
  'node_modules',
  'playwright-report',
  'test-results'
])

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'))

const rootManifest = readJson(path.join(repositoryRoot, 'package.json'))
const repositoryBrand = rootManifest.name
const toDisplayName = (value) =>
  value
    .split(/[-_]/u)
    .map((segment) => `${segment[0].toUpperCase()}${segment.slice(1)}`)
    .join(' ')
const repositoryDisplayName = toDisplayName(repositoryBrand)
const referenceAppManifest = readJson(
  path.join(repositoryRoot, 'apps/asyra-design/package.json')
)
const referenceAppDisplayName = toDisplayName(
  referenceAppManifest.name.split('/').at(-1)
)
const escapedRepositoryBrand = repositoryBrand.replace(
  /[.*+?^${}()|[\]\\]/g,
  '\\$&'
)
const brandedTokenPattern = new RegExp(
  `[A-Za-z0-9_$-]*${escapedRepositoryBrand}[A-Za-z0-9_$-]*`,
  'giu'
)

const sourceFiles = execFileSync(
  'git',
  ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
  {
    cwd: repositoryRoot,
    encoding: 'utf8'
  }
)
  .split('\0')
  .filter(Boolean)
  .filter((relativePath) => {
    const pathSegments = relativePath.split('/')
    if (
      pathSegments[0] === 'docs' ||
      pathSegments.some((segment) => ignoredDirectories.has(segment))
    ) {
      return false
    }

    const fileName = path.basename(relativePath)
    const isEnvironmentFile =
      fileName === '.env' || fileName.startsWith('.env.')
    return sourceExtensions.has(path.extname(fileName)) || isEnvironmentFile
  })
  .map((relativePath) => path.join(repositoryRoot, relativePath))
  .filter((filePath) => fs.existsSync(filePath))

const manifestPaths = sourceFiles.filter(
  (filePath) => path.basename(filePath) === 'package.json'
)
const manifests = manifestPaths.map(readJson)
const publicNames = new Set(
  manifests.flatMap((manifest) => [
    ...(typeof manifest.name === 'string' ? [manifest.name] : []),
    ...Object.keys(manifest.bin ?? {})
  ])
)
const publicSlugs = new Set(
  [...publicNames].flatMap((name) => {
    const unscopedName = name.startsWith('@')
      ? name.slice(1).replace('/', '-')
      : name
    const packageSlug = name.startsWith('@') ? name.split('/')[1] : name
    return [name, unscopedName, packageSlug]
  })
)
const publicIdentityDataValues = new Set([
  'asyra-framework',
  'asyra-framework-demo',
  'asyra-landing-original-design-4x',
  'asyra-landing-v04-approved'
])
const lowercaseIdentityOwnerPaths = new Set([
  'package.json',
  'scripts/__tests__/changeset-all-patch.test.mjs',
  'scripts/__tests__/release-records.test.mjs',
  'scripts/__tests__/create-app-cli.test.mjs',
  'scripts/__tests__/release-automation.test.mjs',
  'scripts/__tests__/test-file-placement.test.mjs',
  'scripts/__tests__/workspace-automation.test.mjs',
  'scripts/release-records.js'
])
const brandOwnedCodePrefixes = Object.freeze(['apps/asyra-framework-site/'])
const capitalizedBrandIdentifierPattern = new RegExp(
  String.raw`(?:\b(?:class|const|enum|export|function|import|interface|let|namespace|type|var)\s+|[({,.]\s*)${repositoryDisplayName}(?=\s*(?:[:=,;)\]}]|$))`,
  'u'
)

const isAllowedPublicIdentity = (token, line, filePath) => {
  const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const relativePath = path.relative(repositoryRoot, filePath)
  if (
    brandOwnedCodePrefixes.some((prefix) => relativePath.startsWith(prefix))
  ) {
    return true
  }
  if (
    publicIdentityDataValues.has(token) &&
    new RegExp(`(['"])[^'"\\n]*${escapedToken}[^'"\\n]*\\1`, 'u').test(line)
  ) {
    return true
  }

  if (token === repositoryDisplayName) {
    return !capitalizedBrandIdentifierPattern.test(line)
  }

  if (token === repositoryDisplayName.toUpperCase()) {
    return true
  }

  if (token === repositoryBrand) {
    return (
      line.includes(`@${repositoryBrand}`) ||
      line.includes(`https://github.com/karote00/${repositoryBrand}`) ||
      (path.basename(filePath) === 'package.json' &&
        new RegExp(`(['"])${escapedRepositoryBrand}\\1`, 'u').test(line)) ||
      (lowercaseIdentityOwnerPaths.has(relativePath) &&
        new RegExp(`/${escapedRepositoryBrand}(?:/|['"])`, 'u').test(line)) ||
      (lowercaseIdentityOwnerPaths.has(relativePath) &&
        new RegExp(`(['"])${escapedRepositoryBrand}\\1`, 'u').test(line))
    )
  }

  for (const slug of publicSlugs) {
    if (token === slug) {
      return true
    }
    if (
      token.startsWith(`${slug}-`) &&
      /^\d/u.test(token.slice(slug.length + 1))
    ) {
      return true
    }
  }

  return false
}

test('Official display names remain distinct from branded code identifiers', () => {
  const fixturePath = path.join(repositoryRoot, 'apps/example.ts')

  assert.equal(
    isAllowedPublicIdentity(
      repositoryDisplayName,
      `const message = '${referenceAppDisplayName} is ready'`,
      fixturePath
    ),
    true
  )
  assert.equal(
    isAllowedPublicIdentity(
      repositoryDisplayName,
      `const ${repositoryDisplayName} = true`,
      fixturePath
    ),
    false
  )
  assert.equal(
    isAllowedPublicIdentity(
      repositoryBrand,
      `const storageKey = '${repositoryBrand}'`,
      fixturePath
    ),
    false
  )
  assert.equal(
    isAllowedPublicIdentity(
      'asyra-framework-demo',
      "const demoUrl = 'https://asra.vercel.app/?fileId=asyra-framework-demo'",
      fixturePath
    ),
    true
  )
  const brandedCamelCase = `${repositoryBrand}FrameworkDemo`
  assert.equal(
    isAllowedPublicIdentity(
      brandedCamelCase,
      `const ${brandedCamelCase} = true`,
      fixturePath
    ),
    false
  )
})

test('Public-facing surfaces preserve the official project identities', () => {
  const appReadme = fs.readFileSync(
    path.join(repositoryRoot, 'apps/asyra-design/README.md'),
    'utf8'
  )
  const appHtml = fs.readFileSync(
    path.join(repositoryRoot, 'apps/asyra-design/index.html'),
    'utf8'
  )
  const appDomainPrompt = fs.readFileSync(
    path.join(repositoryRoot, 'apps/asyra-design/server/ai-domain-prompt.ts'),
    'utf8'
  )
  const cliReadme = fs.readFileSync(
    path.join(repositoryRoot, 'create-app/asyra-design/README.md'),
    'utf8'
  )
  const cliSource = fs.readFileSync(
    path.join(repositoryRoot, 'create-app/asyra-design/bin/index.js'),
    'utf8'
  )
  const templateReadme = fs.readFileSync(
    path.join(repositoryRoot, 'create-app/asyra-design/template/README.md'),
    'utf8'
  )
  const templateHtml = fs.readFileSync(
    path.join(repositoryRoot, 'create-app/asyra-design/template/index.html'),
    'utf8'
  )
  const coreManifest = readJson(
    path.join(repositoryRoot, 'packages/core/package.json')
  )

  assert.match(appReadme, new RegExp(`^# ${referenceAppDisplayName}$`, 'mu'))
  assert.match(
    appReadme,
    new RegExp(
      `${referenceAppDisplayName}[\\s\\S]*${repositoryDisplayName}\\s+Framework`,
      'u'
    )
  )
  assert.match(
    appHtml,
    new RegExp(`<title>${referenceAppDisplayName}</title>`, 'u')
  )
  assert.match(appDomainPrompt, new RegExp(referenceAppDisplayName, 'u'))
  assert.match(
    cliReadme,
    new RegExp(`\\*\\*${referenceAppDisplayName}\\*\\*`, 'u')
  )
  assert.match(cliSource, new RegExp(referenceAppDisplayName, 'u'))
  assert.match(
    templateReadme,
    new RegExp(`^# ${referenceAppDisplayName}`, 'mu')
  )
  assert.match(
    templateHtml,
    new RegExp(`<title>${referenceAppDisplayName}</title>`, 'u')
  )
  assert.match(
    coreManifest.description,
    new RegExp(`\\b${repositoryDisplayName}\\b`, 'u')
  )
})

test('Active docs do not replace the Asyra Design name with a generic label', () => {
  const genericReferenceAppName = new RegExp(
    `(?<!${repositoryDisplayName} )Design App`,
    'u'
  )
  const violations = execFileSync('git', ['ls-files', '-z', 'docs/ai'], {
    cwd: repositoryRoot,
    encoding: 'utf8'
  })
    .split('\0')
    .filter(Boolean)
    .filter((relativePath) => {
      const segments = relativePath.split('/')
      return !segments.some((segment) =>
        ['archive', 'archives', 'complete', 'completed', 'decisions'].includes(
          segment
        )
      )
    })
    .flatMap((relativePath) => {
      const source = fs.readFileSync(
        path.join(repositoryRoot, relativePath),
        'utf8'
      )
      return source
        .split('\n')
        .flatMap((line, index) =>
          genericReferenceAppName.test(line)
            ? [`${relativePath}:${index + 1}`]
            : []
        )
    })

  assert.deepEqual(violations, [])
})

test('Active entry docs position Asyra Design as one product use, not the Framework default', () => {
  const positioningPaths = [
    'README.md',
    'apps/asyra-design/README.md',
    'apps/asyra-design/docs/README.md',
    'create-app/asyra-design/README.md',
    'docs/ai/apps/asyra-design/API_SURFACES.md',
    'docs/ai/framework/CODING_STANDARDS.md',
    'docs/ai/framework/GETTING_STARTED.md',
    'docs/ai/framework/packages/ai-agent-runtime.md',
    'docs/ai/framework/packages/collaboration.md',
    'docs/ai/framework/website/visual-reimagine/handoff.md',
    'docs/public/cases/asyra-design.md',
    'docs/public/index.md',
    'docs/public/start/create-design-app.md'
  ]
  const legacyPositioning =
    /reference[- ](?:app|product)|recommended beginner entrance/iu

  for (const relativePath of positioningPaths) {
    const source = fs.readFileSync(
      path.join(repositoryRoot, relativePath),
      'utf8'
    )
    assert.doesNotMatch(source, legacyPositioning, relativePath)
  }

  assert.match(rootManifest.description, /framework/iu)
  assert.doesNotMatch(rootManifest.description, /^An open-source design tool/u)
})

test('Active product positioning does not claim generic VR support', () => {
  const positioningPaths = [
    'README.md',
    'docs/ai/framework/website/visual-reimagine/concept-manifest.json',
    'docs/ai/framework/website/visual-reimagine/handoff.md',
    'docs/public/build/render-boundary.md',
    'docs/public/index.md',
    'docs/public/start/custom-composition.md'
  ]

  for (const relativePath of positioningPaths) {
    const source = fs.readFileSync(
      path.join(repositoryRoot, relativePath),
      'utf8'
    )
    assert.doesNotMatch(source, /\bVR\b/u, relativePath)
  }
})

test('Programmatic code and configuration use brand-neutral identifiers', () => {
  const violations = sourceFiles.flatMap((filePath) => {
    const source = fs.readFileSync(filePath, 'utf8')
    return source.split('\n').flatMap((line, index) => {
      const matches = line.match(brandedTokenPattern) ?? []
      return matches
        .filter((token) => !isAllowedPublicIdentity(token, line, filePath))
        .map((token) => ({
          file: path.relative(repositoryRoot, filePath),
          line: index + 1,
          token
        }))
    })
  })

  assert.equal(
    violations.length,
    0,
    `${violations.length} brand-coupled code identifiers found:\n${violations
      .slice(0, 50)
      .map(({ file, line, token }) => `${file}:${line} ${token}`)
      .join('\n')}`
  )
})
