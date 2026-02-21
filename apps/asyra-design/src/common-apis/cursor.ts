import { render } from '../contexts'

export const cursorApis = {
  setCanvasCursor: (cursor: string) => {
    const canvas = render?.app?.canvas
    if (!canvas) {
      return
    }

    canvas.style.cursor = cursor
  },

  resetCanvasCursor: () => {
    cursorApis.setCanvasCursor('default')
  }
}
