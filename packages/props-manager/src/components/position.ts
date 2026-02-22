import {
  DataTypes,
  DefaultPositionData,
  PositionAttrs,
  PositionComponentRawData,
  PropertyTypes,
  Unit
} from '@asyra/utils'
import BaseComponent from './base'

const isUnit = (value: unknown): value is Unit =>
  value === Unit.PX || value === Unit.PERCENT

class PositionComponent extends BaseComponent<PositionAttrs> {
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
    this.data.x = typeof data.x === 'number' ? data.x : this.data.x
    this.data.y = typeof data.y === 'number' ? data.y : this.data.y
    this.data.xUnit = isUnit(data.xUnit) ? data.xUnit : this.data.xUnit
    this.data.yUnit = isUnit(data.yUnit) ? data.yUnit : this.data.yUnit
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

export default PositionComponent
