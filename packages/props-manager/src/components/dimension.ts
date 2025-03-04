import { isNil, DimensionComponentRawData, Unit } from '@asra/utils'
import BaseComponent from './base'

type DimensionKeys = keyof DimensionComponentRawData
const PROPS: DimensionKeys[] = ['width', 'height', 'widthUnit', 'heightUnit']

class DimensionComponent extends BaseComponent<DimensionComponentRawData> {
  width: number = 0
  height: number = 0
  widthUnit: Unit = Unit.PX
  heightUnit: Unit = Unit.PX

  update(data: DimensionComponentRawData) {
    PROPS.forEach((key) => {
      if (isNil(data[key])) {
        return
      }

      switch (key) {
        case 'width':
        case 'height':
          this[key] = data[key] as number
          break
        case 'widthUnit':
        case 'heightUnit':
          this[key] = data[key] as Unit
          break
      }
    })
  }

  getValue(): Record<string, number> {
    return {
      width: this.width,
      height: this.height
    }
  }

  getUnit(): Record<string, Unit> {
    return {
      widthUnit: this.widthUnit,
      heightUnit: this.heightUnit
    }
  }
}

export default DimensionComponent
