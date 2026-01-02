export {}

declare global {
  // eslint-disable-next-line no-var
  var DOMRect: new (
    x?: number,
    y?: number,
    width?: number,
    height?: number
  ) => DOMRect
}
