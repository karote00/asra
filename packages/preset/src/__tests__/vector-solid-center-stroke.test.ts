import { beforeAll, describe, expect, it } from 'vitest'
import { BehaviorSubject, Subscription } from 'rxjs'
import { Container, Mesh } from 'pixi.js'
import core, {
  VECTOR_TOKENS,
  renderStrategyRegistry,
  type VectorNetwork,
  type VectorPointNode,
  type VectorSegment
} from '@asyra/core'
import {
  StrokeCapTypes,
  StrokeJoinTypes,
  StrokePositions,
  StrokeStyles,
  createDefaultStroke
} from '@asyra/utils'
import { applyPreset } from '../preset'
import type { PresetDependencies } from '../types'

beforeAll(() => {
  core.defineSystemProperty<string | null>('pathEditingVectorId', null)
  core.defineSystemProperty<boolean>('pathEditingMode', false)
  core.defineSystemProperty<boolean>('mouseDragging', false)

  const systemPropertyMap = new Map<string, BehaviorSubject<unknown>>()
  const presetDeps = {
    sceneTree: {
      getElementById: () => undefined
    },
    systemContext: {
      getManagedProperty: () => undefined,
      getSystemContextSnapshot: () => ({
        primaryTool: 'select',
        mousePosition: { x: 0, y: 0 }
      })
    },
    render: {
      getViewportPosition: () => ({ x: 0, y: 0 }),
      getViewportScale: () => 1,
      getMousePosInWorkspace: () => ({ x: 0, y: 0 }),
      zoomTo: () => undefined,
      panTo: () => undefined
    }
  } as unknown as PresetDependencies

  applyPreset(
    {
      registerEvent: (event: string | { eventName: string }) => ({
        eventName: typeof event === 'string' ? event : event.eventName,
        publish: () => undefined,
        subscribe: () => new Subscription()
      }),
      registerDataChannelObserver: () => undefined,
      getPresetDependencies: () => presetDeps,
      registerRenderLayer: () => undefined,
      registerPropertySchema: () => undefined,
      defineSelection: () => undefined,
      getSelection: () => undefined,
      defineUIProperty: () => undefined,
      defineSystemProperty: <T>(key: string, defaultValue: T) => {
        const existing = systemPropertyMap.get(key)
        if (existing) {
          return existing as BehaviorSubject<T>
        }

        const state = new BehaviorSubject<T>(defaultValue)
        systemPropertyMap.set(key, state as BehaviorSubject<unknown>)
        return state
      },
      getSystemPropertyObservable: <T>(key: string) =>
        systemPropertyMap.get(key) as BehaviorSubject<T> | undefined,
      createRenderGradientFillStyle: () => null as never
    },
    presetDeps
  )
})

class RecordingVectorGraphic extends Container {
  __asyraSolidCenterStrokeExportPackets?: {
    bounds: { minX: number; minY: number; maxX: number; maxY: number }
  }[]
  hitArea?: { contains: (x: number, y: number) => boolean } | null

  clear() {
    return this
  }

  moveTo() {
    return this
  }

  lineTo() {
    return this
  }

  bezierCurveTo() {
    return this
  }

  closePath() {
    return this
  }

  cut() {
    return this
  }

  fill() {
    return this
  }
}

interface TestAnchorPoint {
  id: string
  x: number
  y: number
}

const toVectorData = (anchors: TestAnchorPoint[], closed: boolean) => {
  const points: Record<string, VectorPointNode> = {}
  const segments: Record<string, VectorSegment> = {}
  const networks: Record<string, VectorNetwork> = {
    'network-0': {
      id: 'network-0',
      pointIds: anchors.map((anchor) => anchor.id),
      segmentIds: [],
      closed
    }
  }

  anchors.forEach((anchor, index) => {
    points[anchor.id] = {
      id: anchor.id,
      kind: VECTOR_TOKENS.POINT.KIND.ANCHOR,
      anchorType: 'sharp',
      x: anchor.x,
      y: anchor.y
    }

    if (index === 0) {
      return
    }

    const previous = anchors[index - 1]
    const segmentId = `segment-${index - 1}`
    segments[segmentId] = {
      id: segmentId,
      startId: previous.id,
      endId: anchor.id,
      outControlId: null,
      inControlId: null
    }
    networks['network-0'].segmentIds.push(segmentId)
  })

  if (closed && anchors.length > 1) {
    const first = anchors[0]
    const last = anchors[anchors.length - 1]
    const segmentId = 'segment-close'
    segments[segmentId] = {
      id: segmentId,
      startId: last.id,
      endId: first.id,
      outControlId: null,
      inControlId: null
    }
    networks['network-0'].segmentIds.push(segmentId)
  }

  return {
    points,
    segments,
    networks
  }
}

const runVectorRenderStrategy = (data: Record<string, unknown>) => {
  const strategy = renderStrategyRegistry.get('vector')
  expect(strategy).toBeTypeOf('function')

  const graphic = new RecordingVectorGraphic()
  ;(
    strategy as unknown as (
      graphic: RecordingVectorGraphic,
      data: Record<string, unknown>
    ) => void
  )(graphic, data)

  return graphic
}

const getProjectionMeshes = (host: Container) =>
  host.children.flatMap((child) => {
    if (!(child instanceof Container)) {
      return []
    }

    return child.children.filter(
      (grandchild): grandchild is Mesh => grandchild instanceof Mesh
    )
  })

describe('vector solid-center stroke product wiring', () => {
  it('should run: apply square cap to open-vector export and hit packets on the main render path', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-square-cap',
      x: 0,
      y: 0,
      width: 40,
      height: 20,
      ...toVectorData(
        [
          { id: 'a', x: 0, y: 10 },
          { id: 'b', x: 40, y: 10 }
        ],
        false
      ),
      closed: false,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 6,
          style: StrokeStyles.SOLID,
          position: StrokePositions.CENTER,
          joinType: StrokeJoinTypes.MITER,
          capType: StrokeCapTypes.SQUARE
        })
      ]
    })

    expect(getProjectionMeshes(graphic)).toHaveLength(1)
    expect(graphic.__asyraSolidCenterStrokeExportPackets).toHaveLength(1)
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0].bounds).toEqual({
      minX: -3,
      minY: 7,
      maxX: 43,
      maxY: 13
    })
    expect(graphic.hitArea?.contains(-2, 10)).toBe(true)
    expect(graphic.hitArea?.contains(42, 10)).toBe(true)
    expect(graphic.hitArea?.contains(20, 18)).toBe(false)
  })

  it('should not run: reject unsupported round-cap vectors from the promoted slice on the main render path', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-round-cap',
      x: 0,
      y: 0,
      width: 40,
      height: 20,
      ...toVectorData(
        [
          { id: 'a', x: 0, y: 10 },
          { id: 'b', x: 40, y: 10 }
        ],
        false
      ),
      closed: false,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 6,
          style: StrokeStyles.SOLID,
          position: StrokePositions.CENTER,
          joinType: StrokeJoinTypes.MITER,
          capType: StrokeCapTypes.ROUND
        })
      ]
    })

    expect(getProjectionMeshes(graphic)).toHaveLength(0)
    expect(graphic.__asyraSolidCenterStrokeExportPackets).toEqual([])
    expect(graphic.hitArea).toBeNull()
  })
})
