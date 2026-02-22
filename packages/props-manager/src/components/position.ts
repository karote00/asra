import {
  DataTypes,
  DefaultPositionData,
  PositionAttrs,
  PositionComponentRawData,
  PropertyTypes,
  Unit
} from '@asyra/utils'
import BaseComponent from './base'

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

export default PositionComponent
