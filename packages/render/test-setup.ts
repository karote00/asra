class MockDOMRect {
  x: number
  y: number
  width: number
  height: number

  constructor(x = 0, y = 0, width = 0, height = 0) {
    this.x = x
    this.y = y
    this.width = width
    this.height = height
  }

  get left() {
    return this.x
  }
  get top() {
    return this.y
  }
  get right() {
    return this.x + this.width
  }
  get bottom() {
    return this.y + this.height
  }
}

globalThis.DOMRect = MockDOMRect as unknown as typeof DOMRect
