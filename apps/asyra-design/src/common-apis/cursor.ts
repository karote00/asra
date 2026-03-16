import { render } from '../contexts'

let lastCanvasCursor: string | null = null

export const cursorApis = {
  setCanvasCursor: (cursor: string) => {
    const canvas = render?.app?.canvas
    if (!canvas) {
      return
    }

    if (lastCanvasCursor === cursor) {
      return
    }

    canvas.style.cursor = cursor
    lastCanvasCursor = cursor
  },

  resetCanvasCursor: () => {
    cursorApis.setCanvasCursor('default')
  }
}
