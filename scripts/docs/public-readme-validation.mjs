#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { validatePublicImportMentions } from './public-documentation-validation.mjs'
import { checkPublicDocumentation } from './public-documentation.mjs'
import { readApprovedReadmeInputs } from './public-readme-inputs.mjs'

const REPOSITORY_URL = 'https://github.com/karote00/asyra'
const REQUIRED_POLICY =
  'This repository does not accept external issues or contributions'

const REQUIRED_HEADINGS = Object.freeze({
  root: Object.freeze([
    '## What Asyra is',
    '## Choose your starting point',
    '## Runtime model',
    '## Ownership boundary',
    '## Where Asyra can go',
    '## Current release and roadmap',
    '## Documentation',
    '## Support and contribution policy',
    '## License'
  ]),
  package: Object.freeze([
    '## Install',
    '## Owns',
    '## Does not own',
    '## Start here',
    '## Lifecycle and composition',
    '## Learn more',
    '## Support and policy'
  ]),
  'asyra-design': Object.freeze([
    '## Start in this repository',
    '## Editing paths',
    '## Complete local services',
    '## Extend the product',
    '## Framework and App ownership',
    '## Verify',
    '## Deployment boundary',
    '## Support and contribution policy',
    '## License'
  ]),
  'generated-app-source': Object.freeze([
    '## Install and start',
    '## Start editing',
    '## Run the complete local services',
    '## Make your first extension',
    '## Build with an AI coding agent',
    '## Framework flows',
    '## Verify',
    '## Current release boundary',
    '## Support and contribution policy',
    '## License'
  ]),
  'create-app-cli': Object.freeze([
    '## Create a project',
    '## Start editing',
    '## Run the complete local services',
    '## Continue with Asyra',
    '## Verify',
    '## Generated project contract',
    '## Support and contribution policy',
    '## License'
  ])
})

const INVITATION_PATTERNS = Object.freeze([
  /pull requests? (?:are )?welcome/iu,
  /contributions? (?:are )?welcome/iu,
  /open (?:an |a new )?issue/iu,
  /submit (?:an |a new )?issue/iu
])

const headingSlug = (title) =>
  title
    .toLowerCase()
    .replaceAll('`', '')
    .replace(/<[^>]+>/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')

const headingSlugs = (source) =>
  new Set(
    [...source.matchAll(/^#{1,6}\s+(.+)$/gm)].map((match) =>
      headingSlug(match[1])
    )
  )

const ensureRepositoryTarget = ({
  destination,
  repositoryRoot,
  sourcePath
}) => {
  const url = new URL(destination)
  if (`${url.origin}${url.pathname}` === REPOSITORY_URL) return
  const prefix = `${REPOSITORY_URL}/blob/main/`
  const treePrefix = `${REPOSITORY_URL}/tree/main/`
  let relativeTarget
  if (destination.startsWith(prefix)) {
    relativeTarget = decodeURIComponent(url.pathname.split('/blob/main/')[1])
  } else if (destination.startsWith(treePrefix)) {
    relativeTarget = decodeURIComponent(url.pathname.split('/tree/main/')[1])
  } else if (url.hostname === 'www.npmjs.com') {
    return
  } else {
    throw new Error(
      `${sourcePath} has an unverified public link: ${destination}`
    )
  }
  const targetPath = path.resolve(repositoryRoot, relativeTarget)
  if (!fs.existsSync(targetPath)) {
    throw new Error(
      `${sourcePath} has a broken repository link: ${destination}`
    )
  }
  if (url.hash && targetPath.endsWith('.md')) {
    const targetSource = fs.readFileSync(targetPath, 'utf8')
    if (!headingSlugs(targetSource).has(url.hash.slice(1).toLowerCase())) {
      throw new Error(`${sourcePath} has a broken heading link: ${destination}`)
    }
  }
}

export const validateReadmeLinks = ({ filePath, repositoryRoot, source }) => {
  let linkCount = 0
  for (const match of source.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const destination = match[1].trim()
    if (/^https?:/iu.test(destination)) {
      ensureRepositoryTarget({
        destination,
        repositoryRoot,
        sourcePath: path.relative(repositoryRoot, filePath)
      })
      linkCount += 1
      continue
    }
    const [relativeTarget, fragment] = destination.split('#', 2)
    const targetPath = relativeTarget
      ? path.resolve(path.dirname(filePath), decodeURIComponent(relativeTarget))
      : filePath
    const relativeFromRoot = path.relative(repositoryRoot, targetPath)
    if (
      relativeFromRoot === '..' ||
      relativeFromRoot.startsWith(`..${path.sep}`)
    ) {
      throw new Error(
        `${path.relative(repositoryRoot, filePath)} link escapes the repository: ${destination}`
      )
    }
    if (!fs.existsSync(targetPath)) {
      throw new Error(
        `${path.relative(repositoryRoot, filePath)} has a broken local link: ${destination}`
      )
    }
    if (fragment && targetPath.endsWith('.md')) {
      const targetSource = fs.readFileSync(targetPath, 'utf8')
      if (!headingSlugs(targetSource).has(fragment.toLowerCase())) {
        throw new Error(
          `${path.relative(repositoryRoot, filePath)} has a broken heading link: ${destination}`
        )
      }
    }
    linkCount += 1
  }
  return linkCount
}

const validateHeadings = ({ id, source, sourcePath }) => {
  const key = id.startsWith('@asyra/') ? 'package' : id
  const required = REQUIRED_HEADINGS[key]
  if (!required) return
  required.forEach((heading) => {
    if (!source.includes(`${heading}\n`)) {
      throw new Error(`${sourcePath} is missing ${heading}`)
    }
  })
}

const publicEntryForImport = (packageName) => {
  const [, directory, ...segments] = packageName.split('/')
  return {
    entryPath: segments.length === 0 ? '.' : `./${segments.join('/')}`,
    packageName: `@asyra/${directory}`
  }
}

export const validateReadmeNamedImports = ({
  apiIndex,
  source,
  sourcePath
}) => {
  const packages = new Map(
    apiIndex.packages.map((packageRecord) => [
      packageRecord.name,
      packageRecord
    ])
  )
  for (const match of source.matchAll(
    /import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"](@asyra\/[^'"]+)['"]/g
  )) {
    const { entryPath, packageName } = publicEntryForImport(match[2])
    const packageRecord = packages.get(packageName)
    const entry = packageRecord?.entries.find(
      (entryRecord) => entryRecord.path === entryPath
    )
    if (!entry) {
      throw new Error(`${sourcePath} imports unsupported entry ${match[2]}`)
    }
    const symbols = new Set(entry.symbols)
    const unresolved = match[1]
      .split(',')
      .map((value) => value.trim().split(/\s+as\s+/u)[0])
      .filter(Boolean)
      .filter((symbol) => !symbols.has(symbol))
    if (unresolved.length > 0) {
      throw new Error(
        `${sourcePath} imports unresolved public APIs: ${unresolved.join(', ')}`
      )
    }
  }
}

export const validateReadmePolicy = ({ source, sourcePath }) => {
  if (!source.includes(REQUIRED_POLICY)) {
    throw new Error(`${sourcePath} is missing the public support policy`)
  }
  const invitation = INVITATION_PATTERNS.find((pattern) => pattern.test(source))
  if (invitation) {
    throw new Error(`${sourcePath} invites unsupported external contributions`)
  }
}

const validatePackageReadme = ({ packageRecord, source, sourcePath }) => {
  if (!source.startsWith(`# \`${packageRecord.name}\`\n`)) {
    throw new Error(`${sourcePath} title must be ${packageRecord.name}`)
  }
  if (!source.includes(`npm install ${packageRecord.name}`)) {
    throw new Error(`${sourcePath} is missing its exact install command`)
  }
  const guideUrl = `${REPOSITORY_URL}/blob/main/${packageRecord.guide.path}`
  if (!source.includes(guideUrl)) {
    throw new Error(`${sourcePath} is missing its complete package guide`)
  }
  packageRecord.examples.forEach((example) => {
    const exampleUrl = `${REPOSITORY_URL}/blob/main/${example.source}`
    if (!source.includes(exampleUrl)) {
      throw new Error(
        `${sourcePath} is missing maintained example ${example.id}`
      )
    }
  })
}

export const validatePublicReadmes = async ({ repositoryRoot }) => {
  const root = path.resolve(repositoryRoot)
  const inputs = await readApprovedReadmeInputs({ repositoryRoot: root })
  const documentation = await checkPublicDocumentation({ repositoryRoot: root })
  let linkCount = 0

  for (const surface of inputs.surfaces) {
    const filePath = path.join(root, surface.path)
    const source = fs.readFileSync(filePath, 'utf8')
    validateHeadings({ id: surface.id, source, sourcePath: surface.path })
    validateReadmePolicy({ source, sourcePath: surface.path })
    const publicMentionSource =
      surface.id === 'asyra-design'
        ? source.replaceAll(
            'yarn workspace @asyra/asyra-design',
            'yarn workspace asyra-design'
          )
        : source
    validatePublicImportMentions({
      apiIndex: documentation.apiIndex,
      pageId: surface.path,
      source: publicMentionSource
    })
    validateReadmeNamedImports({
      apiIndex: documentation.apiIndex,
      source,
      sourcePath: surface.path
    })
    const renderedFilePath =
      surface.id === 'generated-app-source'
        ? path.join(root, inputs.generatedReadme.output)
        : filePath
    linkCount += validateReadmeLinks({
      filePath: renderedFilePath,
      repositoryRoot: root,
      source
    })
    if (surface.id.startsWith('@asyra/')) {
      const packageRecord = inputs.packages.find(
        ({ name }) => name === surface.id
      )
      validatePackageReadme({
        packageRecord,
        source,
        sourcePath: surface.path
      })
    }
  }

  const generatedSource = fs.readFileSync(
    path.join(root, inputs.generatedReadme.source)
  )
  const generatedOutput = fs.readFileSync(
    path.join(root, inputs.generatedReadme.output)
  )
  validateGeneratedReadmePair({
    output: generatedOutput,
    source: generatedSource
  })

  return Object.freeze({
    generatedReadmeSynchronized: true,
    linkCount,
    packageCount: inputs.packages.length,
    surfaceCount: inputs.surfaces.length
  })
}

export const validateGeneratedReadmePair = ({ output, source }) => {
  const matches = Buffer.isBuffer(source)
    ? source.equals(output)
    : source === output
  if (!matches) {
    throw new Error('Generated Asyra Design README is stale')
  }
}

const isDirectInvocation =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectInvocation) {
  if (process.argv.length !== 2) {
    throw new Error('Usage: node scripts/docs/public-readme-validation.mjs')
  }
  const repositoryRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../..'
  )
  const summary = await validatePublicReadmes({ repositoryRoot })
  process.stdout.write(
    `Public READMEs valid: ${summary.surfaceCount} surfaces, ${summary.packageCount} packages, ${summary.linkCount} links\n`
  )
}
