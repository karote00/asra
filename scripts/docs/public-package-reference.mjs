#!/usr/bin/env node

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { readPublicContentContract } from './public-content-contract.mjs'
import { readApprovedDocumentationInputs } from './public-documentation-inputs.mjs'

export const PUBLIC_PACKAGE_REFERENCE_PATH =
  'docs/public/generated/package-reference.json'

const REQUIRED_GUIDE_HEADINGS = [
  '## Owns',
  '## Does not own',
  '## Compose when',
  '## Public entrypoints and prerequisites',
  '## Lifecycle, inputs, outputs, and failure',
  '## Relationships',
  '## Maintained use path',
  '## Replacement and disabled behavior',
  '## Support, migration, and deprecation',
  '## Canonical sources and release inventory'
]

const sha256File = (filePath) =>
  createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')

export const createPublicPackageReference = async ({ repositoryRoot }) => {
  const root = path.resolve(repositoryRoot)
  const inputs = await readApprovedDocumentationInputs({ repositoryRoot: root })
  const content = await readPublicContentContract({ repositoryRoot: root })
  const pagesById = new Map(content.pages.map((page) => [page.id, page]))

  const packages = inputs.packages.map((packageRecord) => {
    const guideId = `reference/packages/${packageRecord.directory}`
    const page = pagesById.get(guideId)
    if (!page) {
      throw new Error(`${packageRecord.name} has no public package guide`)
    }
    const guidePath = `docs/public/${page.path}`
    const guideSource = fs.readFileSync(path.join(root, guidePath), 'utf8')
    for (const heading of REQUIRED_GUIDE_HEADINGS) {
      if (!guideSource.includes(heading)) {
        throw new Error(`${guidePath} is missing ${heading}`)
      }
    }

    return {
      contractPath: packageRecord.contractPath,
      directory: packageRecord.directory,
      frameworkDependencies: packageRecord.frameworkDependencies,
      guideId,
      guidePath,
      license: packageRecord.license,
      manifestPath: packageRecord.manifestPath,
      name: packageRecord.name,
      publicEntries: packageRecord.publicEntries,
      sourceDigests: {
        contract: sha256File(path.join(root, packageRecord.contractPath)),
        guide: sha256File(path.join(root, guidePath)),
        manifest: sha256File(path.join(root, packageRecord.manifestPath))
      },
      version: packageRecord.version
    }
  })

  return {
    packages,
    release: {
      family: inputs.release.family,
      packageCount: packages.length,
      publicationAuthorized: inputs.release.publicationAuthorized,
      status: inputs.release.status,
      supportContract: inputs.release.supportContract
    },
    schemaVersion: 1
  }
}

export const serializePublicPackageReference = (reference) =>
  `${JSON.stringify(reference, null, 2)}\n`

export const writePublicPackageReference = async ({ repositoryRoot }) => {
  const reference = await createPublicPackageReference({ repositoryRoot })
  fs.mkdirSync(
    path.dirname(path.join(repositoryRoot, PUBLIC_PACKAGE_REFERENCE_PATH)),
    { recursive: true }
  )
  fs.writeFileSync(
    path.join(repositoryRoot, PUBLIC_PACKAGE_REFERENCE_PATH),
    serializePublicPackageReference(reference)
  )
  return reference
}

export const checkPublicPackageReference = async ({ repositoryRoot }) => {
  const expected = serializePublicPackageReference(
    await createPublicPackageReference({ repositoryRoot })
  )
  const referencePath = path.join(repositoryRoot, PUBLIC_PACKAGE_REFERENCE_PATH)
  if (!fs.existsSync(referencePath)) {
    throw new Error(
      `${PUBLIC_PACKAGE_REFERENCE_PATH} is missing; run the public package reference writer`
    )
  }
  const actual = fs.readFileSync(referencePath, 'utf8')
  if (actual !== expected) {
    throw new Error(
      `${PUBLIC_PACKAGE_REFERENCE_PATH} is stale; regenerate public documentation`
    )
  }
  return JSON.parse(actual)
}

const isDirectInvocation =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectInvocation) {
  const [mode, ...unexpected] = process.argv.slice(2)
  if (!['--check', '--write'].includes(mode) || unexpected.length > 0) {
    throw new Error(
      'Usage: node scripts/docs/public-package-reference.mjs --check|--write'
    )
  }
  const repositoryRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../..'
  )
  const reference =
    mode === '--write'
      ? await writePublicPackageReference({ repositoryRoot })
      : await checkPublicPackageReference({ repositoryRoot })
  process.stdout.write(
    `Public package reference ${
      mode === '--write' ? 'written' : 'current'
    }: ${reference.packages.length} packages\n`
  )
}
