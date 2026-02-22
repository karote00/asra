import type {
  AnchorPointType,
  AnchorPointsAttrs,
  AnchorPointsComponentRawData
} from '@asyra/utils'
import {
  AnchorPointTypes,
  DataTypes,
  PropertyTypes,
  Unit,
  isAnchorPointType
} from '@asyra/utils'
import { getComponentAccessor } from '../component-accessor'
import BaseComponent from './base'

interface AnchorPointLike {
  id: string
  x: number
  y: number
  type: AnchorPointType
  isMove?: boolean
  inHandle: { x: number; y: number } | null
  outHandle: { x: number; y: number } | null
}

const toNumber = (value: unknown, fallback = 0) =>
  typeof value === 'number' ? value : fallback

const toPointType = (value: unknown): AnchorPointType =>
  isAnchorPointType(value) ? value : AnchorPointTypes.SHARP

const toHandle = (value: unknown): { x: number; y: number } | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const handle = value as { x?: unknown; y?: unknown }
  if (typeof handle.x !== 'number' || typeof handle.y !== 'number') {
    return null
  }

  return { x: handle.x, y: handle.y }
}

class AnchorPointsComponent extends BaseComponent<AnchorPointsAttrs> {
  data: AnchorPointsAttrs = {
    id: '',
    type: PropertyTypes.ANCHOR_POINTS,
    anchorPoints: []
  }

  constructor(data: Partial<AnchorPointsAttrs>) {
    super()
    this.data.id = typeof data.id === 'string' ? data.id : this.data.id
    this.data.type = PropertyTypes.ANCHOR_POINTS

    const anchorPoints = (
      data as Partial<AnchorPointsAttrs> & { anchorPoints?: unknown }
    ).anchorPoints

    if (Array.isArray(anchorPoints)) {
      this.set(
        'anchorPoints',
        anchorPoints as unknown as AnchorPointsAttrs['anchorPoints']
      )
    }
  }

  private upsertAnchorPoints(points: AnchorPointLike[]): string[] {
    const accessor = getComponentAccessor()
    const nextIds: string[] = []

    points.forEach((point) => {
      const pointData: Record<string, unknown> = {
        type: PropertyTypes.ANCHOR_POINT,
        x: point.x,
        y: point.y,
        pointType: point.type,
        isMove: point.isMove,
        inHandle: point.inHandle,
        outHandle: point.outHandle
      }

      const pointId = typeof point.id === 'string' ? point.id : ''
      const existingPoint = pointId
        ? accessor.getComponentById(pointId)
        : undefined

      if (
        existingPoint &&
        (existingPoint as { get: (key: string) => unknown }).get('type') ===
          PropertyTypes.ANCHOR_POINT
      ) {
        const setter = existingPoint as {
          set: (key: string, value: unknown) => void
          get: (key: string) => unknown
        }
        setter.set('x', pointData.x)
        setter.set('y', pointData.y)
        setter.set('pointType', pointData.pointType)
        setter.set('isMove', pointData.isMove)
        setter.set('inHandle', pointData.inHandle)
        setter.set('outHandle', pointData.outHandle)
        nextIds.push(setter.get('id') as string)
        return
      }

      const created = accessor.createComponent(
        pointId ? { id: pointId, ...pointData } : pointData
      )
      if (!created) {
        return
      }

      accessor.addToMap(created)
      const createdId = (created as { get: (key: string) => unknown }).get('id')
      if (typeof createdId === 'string') {
        nextIds.push(createdId)
      }
    })

    return nextIds
  }

  protected isValidKey(key: keyof AnchorPointsAttrs) {
    return key === 'anchorPoints'
  }

  set<K extends keyof AnchorPointsAttrs>(
    key: K,
    value: AnchorPointsAttrs[K]
  ): void {
    if (key !== 'anchorPoints') {
      return
    }

    if (
      Array.isArray(value) &&
      value.every((item) => typeof item === 'string')
    ) {
      this.data.anchorPoints = value as string[]
      super.set(key, value)
      return
    }

    if (
      Array.isArray(value) &&
      value.every((item) => item && typeof item === 'object')
    ) {
      const pointIds = this.upsertAnchorPoints(
        value as unknown as AnchorPointLike[]
      )
      this.data.anchorPoints = pointIds
      super.set(key, pointIds as AnchorPointsAttrs[K])
    }
  }

  load(data: AnchorPointsComponentRawData): void {
    const rawAnchorPoints = data.anchorPoints
    if (!Array.isArray(rawAnchorPoints)) {
      this.data.anchorPoints = []
      return
    }

    if (rawAnchorPoints.every((value) => typeof value === 'string')) {
      this.data.anchorPoints = rawAnchorPoints as string[]
      return
    }

    if (rawAnchorPoints.every((value) => value && typeof value === 'object')) {
      const legacyPoints = rawAnchorPoints.map((value) => {
        const point = value as unknown as Record<string, unknown>
        return {
          id: typeof point.id === 'string' ? point.id : '',
          x: toNumber(point.x),
          y: toNumber(point.y),
          type: toPointType(point.type),
          isMove: typeof point.isMove === 'boolean' ? point.isMove : undefined,
          inHandle: toHandle(point.inHandle),
          outHandle: toHandle(point.outHandle)
        } satisfies AnchorPointLike
      })

      this.data.anchorPoints = this.upsertAnchorPoints(legacyPoints)
      return
    }

    this.data.anchorPoints = []
  }

  save(): AnchorPointsComponentRawData {
    return {
      ...super.save(),
      anchorPoints: [...this.data.anchorPoints]
    } as AnchorPointsComponentRawData
  }

  getValue(): Record<string, DataTypes> {
    const accessor = getComponentAccessor()
    const anchorPoints = this.data.anchorPoints
      .map((pointId) => {
        const component = accessor.getComponentById(pointId) as
          | {
              get: (key: string) => unknown
            }
          | undefined
        if (!component) {
          return null
        }

        return {
          id: pointId,
          x: toNumber(component.get('x')),
          y: toNumber(component.get('y')),
          type: toPointType(component.get('pointType')),
          isMove:
            typeof component.get('isMove') === 'boolean'
              ? (component.get('isMove') as boolean)
              : undefined,
          inHandle: toHandle(component.get('inHandle')),
          outHandle: toHandle(component.get('outHandle'))
        } satisfies AnchorPointLike
      })
      .filter((point) => point !== null) as AnchorPointLike[]

    return { anchorPoints }
  }

  getUnit(): Record<string, Unit> {
    return {}
  }
}

export default AnchorPointsComponent
