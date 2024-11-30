import Element from './element'

type RectangleData = {}

type RectangleDataType = Partial<RectangleData>

class Rectangle extends Element {
  constructor(data: RectangleDataType) {
    super(data)

    this._init(data)
  }

  _init(data: RectangleDataType) {}
}

interface Rectangle extends RectangleData {}

export default Rectangle
