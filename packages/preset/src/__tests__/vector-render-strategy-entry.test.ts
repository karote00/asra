import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const vectorComponentSource = () =>
  readFileSync('src/components/vector.ts', 'utf8')

const getVectorRenderStrategyBody = (source: string) => {
  const match = source.match(
    /const vectorRenderStrategy: RenderStrategy = \(graphic, data\) => \{([\s\S]*?)\n\}/
  )
  expect(match).not.toBeNull()
  return match?.[1] ?? ''
}

const getRenderVectorGraphicPrefix = (source: string) => {
  const start = source.indexOf('const renderVectorGraphic = (')
  const firstDomainStage = source.indexOf('buildPathTopologyModel(', start)

  expect(start).toBeGreaterThanOrEqual(0)
  expect(firstDomainStage).toBeGreaterThan(start)

  return source.slice(start, firstDomainStage)
}

const getRestyleStrokePathStyleBody = (source: string) => {
  const start = source.indexOf('const restyleStrokePathStyle = (')
  const end = source.indexOf('\n\nconst restyleStrokeRenderDescriptor', start)

  expect(start).toBeGreaterThanOrEqual(0)
  expect(end).toBeGreaterThan(start)

  return source.slice(start, end)
}

describe('vector render strategy entry', () => {
  it('should run: keep vectorRenderStrategy as an orchestration-only entry wrapper', () => {
    const body = getVectorRenderStrategyBody(vectorComponentSource())

    expect(body).toContain(
      'renderVectorGraphic(graphic, data as unknown as VectorComputedData)'
    )
    expect(body).toContain('renderSolidCenterStrokeEntries(graphic, [])')
    expect(body).not.toMatch(
      /buildPathTopologyModel|buildConstrained|Ownership|ownerSet|legality|paint|geometryId/
    )
  })

  it('should run: normalize render data before any topology or stroke stage work', () => {
    const source = vectorComponentSource()
    const prefix = getRenderVectorGraphicPrefix(source)

    expect(prefix).toContain('normalizeVectorRenderData(data)')
    expect(prefix).not.toMatch(
      /\bdata\.(points|segments|networks|strokes|fills)\b/
    )
    expect(prefix.indexOf('normalizeVectorRenderData(data)')).toBeLessThan(
      prefix.indexOf('graphic.clear()')
    )
  })

  it('should run: preserve explicit fillRule while defaulting missing data at the topology boundary', () => {
    const source = vectorComponentSource()

    expect(source).toContain(
      "value === 'evenodd' || value === 'nonzero' ? value : 'nonzero'"
    )
    expect(source).toContain('normalizeRawPathTopologyFillRule(data.fillRule)')
    expect(source).toContain(
      'normalizeRawPathTopologyFillRule(rawData.fillRule)'
    )
    expect(source).not.toContain(
      "data.fillRule === 'nonzero' ? 'nonzero' : null"
    )
    expect(source).not.toContain(
      "rawData.fillRule === 'nonzero' ? 'nonzero' : null"
    )
  })

  it('should run: preserve descriptor geometry width when replaying stroke style', () => {
    const body = getRestyleStrokePathStyleBody(vectorComponentSource())

    expect(body).not.toContain('width: stroke.width')
    expect(body).toContain('cap: stroke.cap')
    expect(body).toContain('join: stroke.join')
    expect(body).toContain('miterLimit: stroke.miterLimit')
  })
})
