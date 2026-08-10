import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getFeature } from '@asyra/core'
import { describe, expect, it } from 'vitest'
import {
  exampleDefinition,
  installReviewQueueExtension
} from '../../examples/review-queue-extension.mjs'

const appRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
)

const listProductionSources = (directory: string): string[] =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      return entry.name === '__tests__'
        ? []
        : listProductionSources(absolutePath)
    }
    return /\.[cm]?[jt]sx?$/u.test(entry.name) ? [absolutePath] : []
  })

describe('generated Asyra Design app extension example', () => {
  it('publishes a stable public example contract', () => {
    expect(exampleDefinition).toMatchObject({
      id: 'generated-design-app-extension',
      publicPackages: ['@asyra/core'],
      sourceRegion: 'example'
    })
  })

  it('registers app domain behavior only on explicit installation', () => {
    const extension = installReviewQueueExtension()
    try {
      expect(getFeature(extension.featureName)).toBe(extension.api)
      expect(
        extension.api.add({ id: 'review-1', title: 'Factory safety' })
      ).toEqual({
        id: 'review-1',
        status: 'pending',
        title: 'Factory safety'
      })
      expect(extension.api.list()).toHaveLength(1)

      expect(() =>
        extension.api.add({ id: 'review-1', title: 'Duplicate' })
      ).toThrow('Review record already exists: review-1')
      expect(extension.api.list()).toHaveLength(1)
    } finally {
      expect(extension.dispose()).toBe(true)
    }
    expect(() => getFeature(extension.featureName)).toThrow()
  })

  it('stays outside every production source dependency', () => {
    const productionSources = listProductionSources(path.join(appRoot, 'src'))
    const unexpectedImports = productionSources.filter((sourcePath) =>
      fs.readFileSync(sourcePath, 'utf8').includes('review-queue-extension')
    )

    expect(unexpectedImports).toEqual([])
  })
})
