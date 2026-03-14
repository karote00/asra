import { beforeAll, describe, expect, it } from 'vitest'
import { Graphics } from 'pixi.js'
import core, {
  VECTOR_TOKENS,
  renderStrategyRegistry,
  type VectorNetwork,
  type VectorPointNode,
  type VectorSegment
} from '@asyra/core'
import { createDefaultFill } from '@asyra/utils'
import '@asyra/preset'

type Vec2 = { x: number; y: number }

const ensureSystemProperty = <T>(key: string, defaultValue: T) => {
  const existing = core.getSystemProperty<T>(key)
  if (existing !== undefined) {
    return
  }
  core.defineSystemProperty<T>(key, defaultValue)
}

const setPathEditingState = (state: {
  vectorId: string | null
  mode: boolean
  dragging: boolean
  mouseDown: boolean
}) => {
  core.setSystemProperty('pathEditingVectorId', state.vectorId)
  core.setSystemProperty('pathEditingMode', state.mode)
  core.setSystemProperty('mouseDragging', state.dragging)
  core.setSystemProperty('mouseDown', state.mouseDown)
}

const buildClosedPolygon = (id: string, points: Vec2[]) => {
  const pointIds = points.map((_, index) => `${id}-p${index}`)
  const segmentIds: string[] = []
  const pointMap: Record<string, VectorPointNode> = {}
  const segmentMap: Record<string, VectorSegment> = {}

  pointIds.forEach((pointId, index) => {
    const point = points[index]
    pointMap[pointId] = {
      id: pointId,
      kind: VECTOR_TOKENS.POINT.KIND.ANCHOR,
      anchorType: 'sharp',
      x: point.x,
      y: point.y
    }

    const nextIndex = (index + 1) % points.length
    const nextId = pointIds[nextIndex]
    const segmentId = `${id}-s${index}`
    segmentIds.push(segmentId)
    segmentMap[segmentId] = {
      id: segmentId,
      startId: pointId,
      endId: nextId,
      outControlId: null,
      inControlId: null
    }
  })

  const network: VectorNetwork = {
    id: `${id}-n0`,
    pointIds,
    segmentIds,
    closed: true
  }

  return {
    points: pointMap,
    segments: segmentMap,
    networks: { [network.id]: network }
  }
}

const createVectorData = (id: string, points: Vec2[]) => {
  const polygon = buildClosedPolygon(id, points)

  return {
    id,
    x: 0,
    y: 0,
    width: 200,
    height: 200,
    ...polygon,
    closed: true,
    fills: [createDefaultFill({ color: '#ff3355', visible: true })],
    fill: 'none',
    stroke: '#000000',
    strokeWidth: 0
  }
}

const getFillPathInstructions = (graphic: Graphics) => {
  const instructions = graphic.context.instructions as Array<{
    action: string
    data: { path: { instructions: Array<{ action: string; data: number[] }> } }
  }>

  const fillInstruction = instructions.find(
    (instruction) => instruction.action === 'fill'
  )

  return fillInstruction?.data.path.instructions ?? []
}

const pathContainsPoint = (
  instructions: Array<{ action: string; data: number[] }>,
  point: Vec2
) =>
  instructions.some((instruction) => {
    const { data } = instruction
    for (let i = 0; i < data.length - 1; i += 1) {
      const x = data[i]
      const y = data[i + 1]
      if (Math.abs(x - point.x) < 0.001 && Math.abs(y - point.y) < 0.001) {
        return true
      }
    }
    return false
  })

describe('vector preview fill during drag', () => {
  beforeAll(() => {
    ensureSystemProperty('pathEditingVectorId', null)
    ensureSystemProperty('pathEditingMode', false)
    ensureSystemProperty('mouseDragging', false)
    ensureSystemProperty('mouseDown', false)
  })

  it('updates fill path instructions when a drag update arrives', () => {
    expect(renderStrategyRegistry.has('vector')).toBe(true)
    const renderStrategy = renderStrategyRegistry.get('vector')
    expect(renderStrategy).toBeDefined()

    if (!renderStrategy) {
      return
    }

    const vectorId = 'vector-preview-1'
    setPathEditingState({
      vectorId,
      mode: true,
      dragging: true,
      mouseDown: true
    })

    const basePoints = [
      { x: 40, y: 40 },
      { x: 160, y: 40 },
      { x: 160, y: 160 },
      { x: 40, y: 160 }
    ]

    const movedPoint = { x: 180, y: 20 }
    const updatedPoints = [movedPoint, basePoints[1], basePoints[2], basePoints[3]]

    const initialData = createVectorData(vectorId, basePoints)
    const updatedData = createVectorData(vectorId, updatedPoints)

    const graphic = new Graphics()

    renderStrategy(graphic, initialData)
    const initialInstructions = getFillPathInstructions(graphic)

    expect(pathContainsPoint(initialInstructions, basePoints[0])).toBe(true)
    expect(pathContainsPoint(initialInstructions, movedPoint)).toBe(false)

    renderStrategy(graphic, updatedData)
    const updatedInstructions = getFillPathInstructions(graphic)

    expect(pathContainsPoint(updatedInstructions, movedPoint)).toBe(true)
    expect(pathContainsPoint(updatedInstructions, basePoints[0])).toBe(false)
  })
})
