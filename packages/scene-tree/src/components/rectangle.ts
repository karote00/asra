import type { RectangleRawData } from '@asyra/utils'
import { EntityTypes, NameTypes } from '@asyra/utils'
import Element from './element'

type RectangleDataType = Partial<RectangleRawData>

class Rectangle extends Element {
  constructor(data?: Partial<RectangleRawData>) {
    super(data)
  }

  _init(): void {
    this._nameType = NameTypes.RECTANGLE
    super._init()
    this.data.type = EntityTypes.RECTANGLE
  }

  create(): void {
    super.create()
    this.data.type = EntityTypes.RECTANGLE
  }

  load(data: RectangleDataType): void {
    super.load(data)
  }
}

export default Rectangle
