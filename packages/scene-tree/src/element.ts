type ElementData = {}

type ElementDataType = Partial<ElementData>

class Element {
  constructor(data: ElementDataType) {
    this._init(data)
  }

  _init(data: ElementDataType) {}
}

interface Element extends ElementData {}

export default Element
