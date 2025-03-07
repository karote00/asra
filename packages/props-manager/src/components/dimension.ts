import {
  Unit,
  PropertyTypes,
  DefaultDimensionData,
  DimensionAttrs,
  DimensionComponentRawData
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
    this._init(data)
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
