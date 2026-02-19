import {
  DataTypes,
  Unit,
  PropertyTypes,
  DefaultDimensionData,
  DimensionAttrs,
  DimensionComponentRawData
} from '@asyra/utils'
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

  load(data: DimensionComponentRawData): void {
    this.data.width = data.width
    this.data.height = data.height
    this.data.widthUnit = data.widthUnit
    this.data.heightUnit = data.heightUnit
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

export default DimensionComponent
