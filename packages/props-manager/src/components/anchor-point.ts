import type {
  AnchorPointAttrs,
  AnchorPointComponentRawData
} from '@asyra/utils'
import {
  AnchorPointTypes,
  DataTypes,
  PropertyTypes,
  Unit,
  isAnchorPointType
} from '@asyra/utils'
import BaseComponent from './base'

class AnchorPointComponent extends BaseComponent<AnchorPointAttrs> {
  data: AnchorPointAttrs = {
    id: '',
    type: PropertyTypes.ANCHOR_POINT,
    x: 0,
    y: 0,
    pointType: AnchorPointTypes.SHARP,
    isMove: undefined,
    inHandle: null,
    outHandle: null
  }

  constructor(data: Partial<AnchorPointAttrs>) {
    super()
    this.data.id = typeof data.id === 'string' ? data.id : this.data.id
    this.data.type = PropertyTypes.ANCHOR_POINT
    this.load(data as AnchorPointComponentRawData)
  }

  load(data: AnchorPointComponentRawData): void {
    this.data.id = typeof data.id === 'string' ? data.id : this.data.id
    this.data.x = typeof data.x === 'number' ? data.x : this.data.x
    this.data.y = typeof data.y === 'number' ? data.y : this.data.y
    this.data.pointType = isAnchorPointType(data.pointType)
      ? data.pointType
      : this.data.pointType
    this.data.isMove =
      typeof data.isMove === 'boolean' ? data.isMove : undefined
    this.data.inHandle =
      data.inHandle && typeof data.inHandle === 'object'
        ? (data.inHandle as { x: number; y: number })
        : null
    this.data.outHandle =
      data.outHandle && typeof data.outHandle === 'object'
        ? (data.outHandle as { x: number; y: number })
        : null
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

export default AnchorPointComponent
