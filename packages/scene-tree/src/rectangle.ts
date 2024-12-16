import { RectangleRawData, EntityTypes } from '@asra/utils'
import Props from './props'
import Element from './element'

type RectangleDataType = Partial<RectangleRawData>

class Rectangle extends Element {
  props!: Props

  constructor() {
    super()
  }

  _init(): void {
    this._entityType = EntityTypes.RECTANGLE
    super._init()
  }

  load(data: RectangleDataType): void {
    super.load(data)
  }
}

export default Rectangle
