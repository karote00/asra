import { render } from '@asra/render'
import { app, setPixiApp } from '../states/app'
import { CANVAS_BACKGROUND_COLOR } from '../constants'

export const initRenderApp = async (
  container: HTMLDivElement,
  width: number,
  height: number
) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const setupPixiApp = (newApp: any) => {
    if (newApp && newApp.canvas && !container.children.length) {
      container.appendChild(newApp.canvas)
      setPixiApp(newApp)
    }
  }

  await render.init(width, height, CANVAS_BACKGROUND_COLOR, setupPixiApp)
}

export const destroyRenderApp = () => {
  const renderApp = app.value
  if (!renderApp) {
    return
  }

  setPixiApp(null)
  renderApp.destroy(true, {
    children: true,
    texture: true
  })
}
