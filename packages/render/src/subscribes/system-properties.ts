import systemContext from '@asyra/system-context'
import { PositionData } from '@asyra/utils'
import render from '../render'

let hasInit = false

export const initSystemProperties = () => {
  if (hasInit) {
    return
  }

  const zoomObservable = systemContext.registerProperty<number>('zoom', 1, {
    silent: true
  })

  const positionObservable = systemContext.registerProperty<PositionData>(
    'viewportPosition',
    { x: 0, y: 0 },
    { silent: true }
  )

  zoomObservable?.subscribe((scale) => {
    if (scale !== undefined) {
      render.zoomTo(scale)
    }
  })

  positionObservable?.subscribe((position) => {
    if (position) {
      render.panTo(position.x, position.y)
    }
  })

  hasInit = true
}
