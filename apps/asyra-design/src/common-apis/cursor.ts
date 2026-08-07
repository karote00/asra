import core from '../contexts'

let lastCanvasCursor: string | null = null

export const cursorApis = {
  setCanvasCursor: (cursor: string) => {
    if (lastCanvasCursor === cursor) {
      return
    }

    if (core.setCanvasCursor(cursor)) {
      lastCanvasCursor = cursor
    }
  },

  resetCanvasCursor: () => {
    cursorApis.setCanvasCursor('default')
  }
}
