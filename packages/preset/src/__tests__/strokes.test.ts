import { describe, expect, it } from 'vitest'
import {
  StrokePositions,
  StrokeStyles,
  createDefaultStroke
} from '@asyra/utils'
import {
  buildStrokeHitSegments,
  renderPolylineStrokes
} from '../components/strokes'

type Instruction =
  | { action: 'beginPath' }
  | { action: 'moveTo' | 'lineTo'; x: number; y: number }
  | { action: 'closePath' }
  | { action: 'stroke'; value: unknown }
  | { action: 'fill'; value: unknown }

class FakeGraphic {
  children: FakeGraphic[] = []
  instructions: Instruction[] = []
  mask: unknown = null
  inverseMask = false
  visible = true
  renderable = true

  clear() {
    this.instructions = []
  }

  beginPath() {
    this.instructions.push({ action: 'beginPath' })
  }

  moveTo(x: number, y: number) {
    this.instructions.push({ action: 'moveTo', x, y })
  }

  lineTo(x: number, y: number) {
    this.instructions.push({ action: 'lineTo', x, y })
  }

  closePath() {
    this.instructions.push({ action: 'closePath' })
  }

  stroke(value: unknown) {
    this.instructions.push({ action: 'stroke', value })
  }

  fill(value?: unknown) {
    this.instructions.push({ action: 'fill', value })
  }

  addChild(child: FakeGraphic) {
    this.children.push(child)
    return child
  }

  setMask(options: { mask: unknown; inverse?: boolean }) {
    this.mask = options.mask
    this.inverseMask = Boolean(options.inverse)
  }
}

describe('stroke renderer', () => {
  it('keeps dashed sub-paths continuous across corners on the original centerline', () => {
    const graphic = new FakeGraphic()

    renderPolylineStrokes(
      graphic,
      [
        {
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 }
          ],
          closed: false
        }
      ],
      [
        createDefaultStroke({
          style: StrokeStyles.DASHED,
          width: 2,
          dash: 12,
          gap: 100
        })
      ]
    )

    expect(graphic.instructions).toEqual([
      { action: 'beginPath' },
      { action: 'moveTo', x: 0, y: 0 },
      { action: 'lineTo', x: 10, y: 0 },
      { action: 'lineTo', x: 10, y: 2 },
      {
        action: 'stroke',
        value: expect.objectContaining({
          width: 2
        })
      }
    ])
  })

  it('offsets closed stroke centerlines for inside and outside positions', () => {
    const graphic = new FakeGraphic()

    renderPolylineStrokes(
      graphic,
      [
        {
          points: [
            { x: 0, y: 0 },
            { x: 20, y: 0 },
            { x: 20, y: 20 },
            { x: 0, y: 20 }
          ],
          closed: true
        }
      ],
      [
        createDefaultStroke({
          position: StrokePositions.INSIDE,
          width: 10
        }),
        createDefaultStroke({
          position: StrokePositions.OUTSIDE,
          width: 10
        })
      ]
    )

    expect(graphic.instructions).toEqual([
      { action: 'beginPath' },
      { action: 'moveTo', x: -5, y: -5 },
      { action: 'lineTo', x: 25, y: -5 },
      { action: 'lineTo', x: 25, y: 25 },
      { action: 'lineTo', x: -5, y: 25 },
      { action: 'closePath' },
      {
        action: 'stroke',
        value: expect.objectContaining({
          width: 10
        })
      }
    ])
    expect(graphic.children).toHaveLength(3)

    const [maskGraphic, insideGraphic, outsideGraphic] = graphic.children
    expect(
      maskGraphic.instructions[maskGraphic.instructions.length - 1]
    ).toEqual({
      action: 'fill',
      value: 0xffffff
    })
    expect(insideGraphic.mask).toBe(maskGraphic)
    expect(outsideGraphic.inverseMask).toBe(true)
    expect(insideGraphic.instructions).toEqual([
      { action: 'beginPath' },
      { action: 'moveTo', x: 5, y: 5 },
      { action: 'lineTo', x: 15, y: 5 },
      { action: 'lineTo', x: 15, y: 15 },
      { action: 'lineTo', x: 5, y: 15 },
      { action: 'closePath' },
      {
        action: 'stroke',
        value: expect.objectContaining({
          width: 10
        })
      }
    ])
    expect(outsideGraphic.instructions).toEqual([])
  })

  it('splits centered closed strokes across inside and outside overlays', () => {
    const graphic = new FakeGraphic()

    renderPolylineStrokes(
      graphic,
      [
        {
          points: [
            { x: 0, y: 0 },
            { x: 20, y: 0 },
            { x: 20, y: 20 },
            { x: 0, y: 20 }
          ],
          closed: true
        }
      ],
      [
        createDefaultStroke({
          position: StrokePositions.CENTER,
          width: 10
        })
      ]
    )

    expect(graphic.instructions).toEqual([])
    expect(graphic.children).toHaveLength(3)

    const [maskGraphic, insideGraphic, outsideGraphic] = graphic.children
    expect(insideGraphic.mask).toBe(maskGraphic)
    expect(outsideGraphic.inverseMask).toBe(true)
    expect(insideGraphic.instructions).toEqual([
      { action: 'beginPath' },
      { action: 'moveTo', x: 0, y: 0 },
      { action: 'lineTo', x: 20, y: 0 },
      { action: 'lineTo', x: 20, y: 20 },
      { action: 'lineTo', x: 0, y: 20 },
      { action: 'closePath' },
      {
        action: 'stroke',
        value: expect.objectContaining({
          width: 10
        })
      }
    ])
    expect(outsideGraphic.instructions).toEqual(insideGraphic.instructions)
  })

  it('builds hit segments from the rendered outside stroke geometry', () => {
    const hitSegments = buildStrokeHitSegments(
      [
        {
          points: [
            { x: 0, y: 0 },
            { x: 20, y: 0 },
            { x: 20, y: 20 },
            { x: 0, y: 20 }
          ],
          closed: true
        }
      ],
      [
        createDefaultStroke({
          position: StrokePositions.OUTSIDE,
          width: 10
        })
      ]
    )

    expect(hitSegments).toEqual([
      { start: { x: -5, y: -5 }, end: { x: 25, y: -5 }, radius: 5 },
      { start: { x: 25, y: -5 }, end: { x: 25, y: 25 }, radius: 5 },
      { start: { x: 25, y: 25 }, end: { x: -5, y: 25 }, radius: 5 },
      { start: { x: -5, y: 25 }, end: { x: -5, y: -5 }, radius: 5 }
    ])
  })

  it('builds hit segments only for rendered dashed stroke parts', () => {
    const hitSegments = buildStrokeHitSegments(
      [
        {
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 }
          ],
          closed: false
        }
      ],
      [
        createDefaultStroke({
          style: StrokeStyles.DASHED,
          width: 2,
          dash: 12,
          gap: 100
        })
      ]
    )

    expect(hitSegments).toEqual([
      { start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, radius: 1 },
      { start: { x: 10, y: 0 }, end: { x: 10, y: 2 }, radius: 1 }
    ])
  })
})
