import Render from '@asra/render'
import { app, setPixiApp } from '../states/app'
import { CANVAS_BACKGROUND_COLOR } from '../constants'

const render = new Render()

export const initRenderApp = async (
  container: HTMLDivElement,
  width: number,
  height: number
) => {
  const newApp = await render.init(width, height, CANVAS_BACKGROUND_COLOR)

  if (!container.children.length) {
    container.appendChild(newApp.canvas as HTMLCanvasElement)
    setPixiApp(newApp)
  }
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
