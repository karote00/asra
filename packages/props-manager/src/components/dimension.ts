import {
  DataTypes,
  Unit,
  PropertyTypes,
  DefaultDimensionData,
  DimensionAttrs,
  DimensionComponentRawData
} from '@asyra/utils'
import BaseComponent from './base'

const isUnit = (value: unknown): value is Unit =>
  value === Unit.PX || value === Unit.PERCENT

class DimensionComponent extends BaseComponent<DimensionAttrs> {
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
    this.data.width =
      typeof data.width === 'number' ? data.width : this.data.width
    this.data.height =
      typeof data.height === 'number' ? data.height : this.data.height
    this.data.widthUnit = isUnit(data.widthUnit)
      ? data.widthUnit
      : this.data.widthUnit
    this.data.heightUnit = isUnit(data.heightUnit)
      ? data.heightUnit
      : this.data.heightUnit
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
