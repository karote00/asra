import BasePropertyComponent from '../../components/base'
import { getPropertyComponentAccessor } from '../../manager/component-accessor'
import type {
  AnchorPointType,
  AnchorPointsAttrs,
  AnchorPointsComponentRawData,
  AnchorPointAttrs,
  AnchorPointComponentRawData,
  DimensionAttrs,
  DimensionComponentRawData,
  PositionAttrs,
  PositionComponentRawData,
  PropertyComponentInstanceDataTypes,
  PropertyComponentRawData
} from '@asyra/utils'
import {
  AnchorPointTypes,
  createDefaultAnchorPointsData,
  DataTypes,
  DefaultAnchorPointData,
  DefaultDimensionData,
  DefaultPositionData,
  PropertyTypes,
  Unit,
  isAnchorPointType
} from '@asyra/utils'

class PositionComponent extends BasePropertyComponent<PositionAttrs> {
  data: PositionAttrs = {
    id: '',
    type: PropertyTypes.POSITION,
    ...DefaultPositionData
  }

  constructor(data: Partial<PositionAttrs>) {
    super()
    this.data.id = typeof data.id === 'string' ? data.id : this.data.id
    this.data.type = PropertyTypes.POSITION
    this.load(data as PositionComponentRawData)
  }

  save(): PositionComponentRawData {
    return {
      ...super.save(),
      x: this.get('x'),
      y: this.get('y'),
      xUnit: this.get('xUnit'),
      yUnit: this.get('yUnit')
    }
  }

  load(data: PositionComponentRawData): void {
    this.data.id = typeof data.id === 'string' ? data.id : this.data.id
    this.assignLoadedValue('x', data.x)
    this.assignLoadedValue('y', data.y)
    this.assignLoadedValue('xUnit', data.xUnit)
    this.assignLoadedValue('yUnit', data.yUnit)
  }

  getValue(): Record<string, DataTypes> {
    return {
      x: this.data.x,
      y: this.data.y
    }
  }

  getUnit(): Record<string, Unit> {
    return {
      xUnit: this.data.xUnit,
      yUnit: this.data.yUnit
    }
  }
}

class DimensionComponent extends BasePropertyComponent<DimensionAttrs> {
  data: DimensionAttrs = {
    id: '',
    type: PropertyTypes.DIMENSION,
    ...DefaultDimensionData
  }

  constructor(data: Partial<DimensionAttrs>) {
    super()
    this.data.id = typeof data.id === 'string' ? data.id : this.data.id
    this.data.type = PropertyTypes.DIMENSION
    this.load(data as DimensionComponentRawData)
  }

  save(): DimensionComponentRawData {
    return {
      ...super.save(),
      width: this.get('width'),
      height: this.get('height'),
      widthUnit: this.get('widthUnit'),
      heightUnit: this.get('heightUnit')
    }
  }

  load(data: DimensionComponentRawData): void {
    this.data.id = typeof data.id === 'string' ? data.id : this.data.id
    this.assignLoadedValue('width', data.width)
    this.assignLoadedValue('height', data.height)
    this.assignLoadedValue('widthUnit', data.widthUnit)
    this.assignLoadedValue('heightUnit', data.heightUnit)
  }

  getValue(): Record<string, DataTypes> {
    return {
      width: this.data.width,
      height: this.data.height
    }
  }

  getUnit(): Record<string, Unit> {
    return {
      widthUnit: this.data.widthUnit,
      heightUnit: this.data.heightUnit
    }
  }
}

const RESERVED_KEYS = ['id', 'type']

class CustomComponent extends BasePropertyComponent<PropertyComponentInstanceDataTypes> {
  data: PropertyComponentInstanceDataTypes = {
    id: '',
    type: PropertyTypes.CUSTOM
  }

  constructor(data: Partial<PropertyComponentInstanceDataTypes>) {
    super()
    this.data.id = typeof data.id === 'string' ? data.id : ''
    this.data.type = PropertyTypes.CUSTOM
    this._init(data)
  }

  protected isValidKey(key: string | number | symbol): boolean {
    return typeof key === 'string' && !RESERVED_KEYS.includes(key)
  }

  set<K extends keyof PropertyComponentInstanceDataTypes>(
    key: K,
    value: PropertyComponentInstanceDataTypes[K]
  ) {
    if (this.isValidKey(key)) {
      this.data[key] = value
      super.set(key, value)
    }
  }

  save(): PropertyComponentRawData {
    const data = super.save()
    const customData = this.getValue()
    return {
      ...data,
      ...customData
    } as PropertyComponentRawData
  }

  load(data: PropertyComponentRawData): void {
    this.data.id = typeof data.id === 'string' ? data.id : this.data.id
    const dataObj = data as unknown as Record<string, unknown>
    const dataRecord = this.data as unknown as Record<string, unknown>
    Object.keys(dataObj).forEach((key) => {
      if (this.isValidKey(key) && dataObj[key] !== undefined) {
        dataRecord[key] = dataObj[key] as DataTypes
      }
    })
  }

  getValue(): Record<string, DataTypes> {
    const result: Record<string, DataTypes> = {}
    const dataObj = this.data as unknown as Record<string, unknown>
    Object.keys(dataObj).forEach((key) => {
      if (this.isValidKey(key)) {
        const val = dataObj[key]
        if (val !== undefined) {
          result[key] = val as DataTypes
        }
      }
    })
    return result
  }

  getUnit(): Record<string, Unit> {
    return {}
  }
}

class AnchorPointComponent extends BasePropertyComponent<AnchorPointAttrs> {
  data: AnchorPointAttrs = {
    id: '',
    type: PropertyTypes.ANCHOR_POINT,
    ...DefaultAnchorPointData
  }

  constructor(data: Partial<AnchorPointAttrs>) {
    super()
    this.data.id = typeof data.id === 'string' ? data.id : this.data.id
    this.data.type = PropertyTypes.ANCHOR_POINT
    this.load(data as AnchorPointComponentRawData)
  }

  load(data: AnchorPointComponentRawData): void {
    this.data.id = typeof data.id === 'string' ? data.id : this.data.id
    this.assignLoadedValue('x', data.x)
    this.assignLoadedValue('y', data.y)
    this.assignLoadedValue('pointType', data.pointType)
    this.assignLoadedValue('isMove', data.isMove)
    this.assignLoadedValue('inHandle', data.inHandle)
    this.assignLoadedValue('outHandle', data.outHandle)
  }

  save(): AnchorPointComponentRawData {
    return {
      ...super.save(),
      x: this.data.x,
      y: this.data.y,
      pointType: this.data.pointType,
      isMove: this.data.isMove,
      inHandle: this.data.inHandle,
      outHandle: this.data.outHandle
    } as AnchorPointComponentRawData
  }

  getValue(): Record<string, DataTypes> {
    return {
      x: this.data.x,
      y: this.data.y,
      pointType: this.data.pointType,
      isMove: this.data.isMove ?? false,
      inHandle: this.data.inHandle as unknown as Record<string, unknown> | null,
      outHandle: this.data.outHandle as unknown as Record<
        string,
        unknown
      > | null
    }
  }

  getUnit(): Record<string, Unit> {
    return {}
  }
}

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

class AnchorPointsComponent extends BasePropertyComponent<AnchorPointsAttrs> {
  data: AnchorPointsAttrs = {
    id: '',
    type: PropertyTypes.ANCHOR_POINTS,
    ...createDefaultAnchorPointsData()
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
    const accessor = getPropertyComponentAccessor()
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
        ? accessor.getPropertyById(pointId)
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
    const accessor = getPropertyComponentAccessor()
    const anchorPoints = this.data.anchorPoints
      .map((pointId) => {
        const component = accessor.getPropertyById(pointId) as
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

export {
  PositionComponent,
  DimensionComponent,
  CustomComponent,
  AnchorPointComponent,
  AnchorPointsComponent
}
