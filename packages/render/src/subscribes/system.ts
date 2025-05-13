import { emitInitRender, subscribeToInitRender } from '@asra/reactive-events'
import render from '../render'

let hasInit = false

export const initSystemContext = () => {
  if (hasInit) {
    return
  }

  subscribeToInitRender(async ({ payload }) => {
    const { requestId, width, height, color } = payload
    const newApp = await render.init(width, height, color)
    emitInitRender(requestId, newApp)
  })

  hasInit = true
}
