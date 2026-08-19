import fs from 'node:fs'
import path from 'node:path'

import { readApprovedDocumentationInputs } from './public-documentation-inputs.mjs'
import { readPublicContentContract } from './public-content-contract.mjs'

const EXPECTED_SPECIAL_SURFACES = Object.freeze([
  Object.freeze({ id: 'root', owner: 'repository', path: 'README.md' }),
  Object.freeze({
    id: 'asyra-design',
    owner: 'Asyra Design',
    path: 'apps/asyra-design/README.md'
  }),
  Object.freeze({
    id: 'generated-app-source',
    owner: 'Asyra Design template source',
    path: 'apps/asyra-design/TEMPLATE.md'
  }),
  Object.freeze({
    id: 'create-app-cli',
    owner: 'create-asyra-design-app CLI',
    path: 'create-app/asyra-design/README.md'
  }),
  Object.freeze({
    id: 'generated-app-output',
    owner: 'official template generator',
    path: 'create-app/asyra-design/template/README.md'
  }),
  Object.freeze({
    id: 'asyra-starter',
    owner: 'Asyra starter',
    path: 'apps/asyra-starter/README.md'
  }),
  Object.freeze({
    id: 'asyra-starter-source',
    owner: 'Asyra starter template source',
    path: 'apps/asyra-starter/TEMPLATE.md'
  }),
  Object.freeze({
    id: 'create-asyra-app-cli',
    owner: 'create-asyra-app CLI',
    path: 'create-app/asyra/README.md'
  }),
  Object.freeze({
    id: 'asyra-starter-output',
    owner: 'official template generator',
    path: 'create-app/asyra/template/README.md'
  })
])

const freeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value
  }
  Object.freeze(value)
  Object.values(value).forEach(freeze)
  return value
}

const normalize = (filePath) => filePath.replaceAll(path.sep, '/')

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'))

export const readApprovedReadmeInputs = async ({ repositoryRoot }) => {
  const root = path.resolve(repositoryRoot)
  const documentation = await readApprovedDocumentationInputs({
    repositoryRoot: root
  })
  const content = await readPublicContentContract({ repositoryRoot: root })
  const packageGuides = new Map(
    content.pages
      .filter((page) => page.id.startsWith('reference/packages/'))
      .map((page) => [page.packages[0], page])
  )

  const packages = documentation.packages.map((packageRecord) => {
    const guide = packageGuides.get(packageRecord.name)
    if (!guide) {
      throw new Error(`Missing public README guide for ${packageRecord.name}`)
    }
    return {
      directory: packageRecord.directory,
      guide: {
        id: guide.id,
        path: normalize(path.join('docs/public', guide.path)),
        title: guide.title
      },
      manifestPath: packageRecord.manifestPath,
      name: packageRecord.name,
      publicEntries: packageRecord.publicEntries,
      readmePath: `packages/${packageRecord.directory}/README.md`,
      version: packageRecord.version
    }
  })

  const releaseConfigPath = path.join(root, 'release-configs/asyra-design.json')
  const releaseConfig = readJson(releaseConfigPath)
  if (releaseConfig.readme !== 'apps/asyra-design/TEMPLATE.md') {
    throw new Error('Asyra Design generated README source contract changed')
  }
  if (releaseConfig.dest !== 'create-app/asyra-design/template') {
    throw new Error('Asyra Design generated output contract changed')
  }

  const starterReleaseConfig = readJson(
    path.join(root, 'release-configs/asyra-starter.json')
  )
  if (starterReleaseConfig.readme !== 'apps/asyra-starter/TEMPLATE.md') {
    throw new Error('Asyra starter generated README source contract changed')
  }
  if (starterReleaseConfig.dest !== 'create-app/asyra/template') {
    throw new Error('Asyra starter generated output contract changed')
  }

  const surfaces = [
    ...packages.map((packageRecord) => ({
      id: packageRecord.name,
      owner: packageRecord.name,
      path: packageRecord.readmePath
    })),
    ...EXPECTED_SPECIAL_SURFACES
  ]
  surfaces.forEach((surface) => {
    if (!fs.existsSync(path.join(root, surface.path))) {
      throw new Error(`Missing public README surface: ${surface.path}`)
    }
  })

  return freeze({
    packages,
    release: documentation.release,
    schemaVersion: 1,
    specialSurfaces: EXPECTED_SPECIAL_SURFACES,
    surfaces,
    generatedReadme: {
      configPath: normalize(path.relative(root, releaseConfigPath)),
      output: 'create-app/asyra-design/template/README.md',
      source: releaseConfig.readme
    }
  })
}
