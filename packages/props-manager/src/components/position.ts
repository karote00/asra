import { isNil, PositionComponentRawData, Unit } from '@asra/utils'
import BaseComponent from './base'

type PositionKeys = keyof PositionComponentRawData
const PROPS: PositionKeys[] = ['x', 'y', 'xUnit', 'yUnit']

class PositionComponent extends BaseComponent<PositionComponentRawData> {
  x: number = 0
  y: number = 0
  xUnit: Unit = Unit.PX
  yUnit: Unit = Unit.PX

  update(data: PositionComponentRawData) {
    PROPS.forEach((key) => {
      if (isNil(data[key])) {
        return
      }

      switch (key) {
        case 'x':
        case 'y':
          this[key] = data[key] as number
          break
        case 'xUnit':
        case 'yUnit':
          this[key] = data[key] as Unit
          break
      }
    })
  }

  getValue(): Record<string, number> {
    return {
      x: this.x,
      y: this.y
    }
  }

  getUnit(): Record<string, Unit> {
    return {
      xUnit: this.xUnit,
      yUnit: this.yUnit
    }
  }
}

export default PositionComponent
