import {
  Unit,
  PropertyTypes,
  DefaultDimensionData,
  DimensionAttrs
} from '@asra/utils'
import BaseComponent from './base'

class DimensionComponent extends BaseComponent<DimensionAttrs> {
  data: DimensionAttrs = {
    id: '',
    type: PropertyTypes.DIMENSION,
    ...DefaultDimensionData
  }

  constructor(data: Partial<DimensionAttrs>) {
    super()

    this.data.type = PropertyTypes.DIMENSION
    this.init(data)
  }

  getValue(): Record<string, number> {
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

export default DimensionComponent
