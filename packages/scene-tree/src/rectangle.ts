import Props from './props'
import Element from './element'
import { RectangleRawData } from '@asra/utils'

type RectangleDataType = Partial<RectangleRawData>

class Rectangle extends Element {
  props!: Props

  constructor() {
    super()

    this._init()
  }

  _init(): void {}

  load(data: RectangleDataType): void {
    super.load(data)
  }
}

export default Rectangle
