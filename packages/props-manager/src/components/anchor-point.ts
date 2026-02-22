import type {
  AnchorPointAttrs,
  AnchorPointComponentRawData
} from '@asyra/utils'
import {
  AnchorPointTypes,
  DataTypes,
  PropertyTypes,
  Unit
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

export default AnchorPointComponent
