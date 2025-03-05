import {
  DefaultPositionData,
  PositionAttrs,
  PropertyTypes,
  Unit
} from '@asra/utils'
import BaseComponent from './base'

class PositionComponent extends BaseComponent<PositionAttrs> {
  data: PositionAttrs = {
    id: '',
    type: PropertyTypes.POSITION,
    ...DefaultPositionData
  }

  constructor(data: Partial<PositionAttrs>) {
    super()

    this.init(data)
  }

  getValue(): Record<string, number> {
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
