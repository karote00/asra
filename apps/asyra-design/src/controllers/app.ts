import { app, setPixiApp } from '../states/app'
import { CANVAS_BACKGROUND_COLOR, PrimaryToolType } from '../constants'
import core from '../contexts'

console.log('[controllers/app.ts] Module loaded')

// NOTE: Using feature-system API for switchPrimaryTool
// @ts-ignore - feature-system not fully integrated yet
import { importFeature } from '@asyra/feature-system'

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
  try {
    const switchPrimaryToolFeature: any = importFeature('switchPrimaryTool')
    if (switchPrimaryToolFeature?.api?.switch) {
      switchPrimaryToolFeature.api.switch(primaryTool)
    }
  } catch (error) {
    console.error('[app.controller.switchPrimaryTool] Error:', error)
  }
}
