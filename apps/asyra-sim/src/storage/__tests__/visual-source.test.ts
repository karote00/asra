import { expect, it } from 'vitest'
import { validateVisualSources, VISUAL_SOURCE_PROFILE } from '../visual-source'

it('enforces the published aggregate raw-byte cap independently of encoded string size', () => {
  expect(VISUAL_SOURCE_PROFILE).toEqual({
    maxSources: 256,
    maxBytes: 16 * 1024 * 1024,
    maxArchiveBytes: 64 * 1024 * 1024,
    maxVertices: 1000000,
    maxIndices: 3000000
  })
  const byteLength = 16 * 1024 * 1024
  const base64 = `${'A'.repeat(Math.ceil(byteLength / 3) * 4 - 2)}==`
  const sources = Array.from({ length: 4 }, (_, index) => ({
    version: 1,
    assetId: String(index).padStart(64, '0'),
    filename: `source-${index}.glb`,
    byteLength,
    base64
  }))
  expect(validateVisualSources(sources)).toHaveLength(4)
  expect(() =>
    validateVisualSources([
      ...sources,
      {
        ...sources[0],
        assetId: 'f'.repeat(64)
      }
    ])
  ).toThrow('aggregate byte limit')
})
