import { app, setPixiApp } from '../states/app'
import { CANVAS_BACKGROUND_COLOR } from '../constants'
import { core } from '../contexts'

export const initRenderApp = async (
  container: HTMLDivElement,
  width: number,
  height: number
) => {
  const newApp = await core.renderManager.initRender(
    width,
    height,
    CANVAS_BACKGROUND_COLOR
  )

  if (newApp && newApp.canvas && !container.children.length) {
    container.appendChild(newApp.canvas)
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
