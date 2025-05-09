import { finishInitRender, subscribeToInitRender } from '@asra/reactive-events'
import render from '../render'

let hasInit = false

export const initSystemContext = () => {
  if (hasInit) {
    return
  }

  subscribeToInitRender(async ({ payload }) => {
    const { width, height, color } = payload
    const newApp = await render.init(width, height, color)
    finishInitRender(newApp)
  })

  hasInit = true
}
