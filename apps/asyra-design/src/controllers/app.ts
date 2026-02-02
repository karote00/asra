import { app, setPixiApp } from '../states/app'
import { CANVAS_BACKGROUND_COLOR, PrimaryToolType } from '../constants'
import core from '../contexts'
import { decideToSwitchPrimaryTool } from '../init/events/interaction'

export const initRenderApp = async (
  container: HTMLDivElement,
  width: number,
  height: number
) => {
  const newApp = await core.initRender(width, height, CANVAS_BACKGROUND_COLOR)

  if (newApp && newApp.canvas && !container.children.length) {
    container.appendChild(newApp.canvas)
    setPixiApp(newApp)

    return newApp.canvas
  }

  return null
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

export const setupInputSystem = (canvas: HTMLElement) => {
  core.setupInputSystem(canvas)
}

export const renderIsReady = () => {
  core.renderIsReady()
}

export const resetData = () => {
  localStorage.setItem('FILE', JSON.stringify({}))
  location.reload()
}

export const switchPrimaryTool = (primaryTool: PrimaryToolType) => {
  decideToSwitchPrimaryTool(primaryTool)
}
