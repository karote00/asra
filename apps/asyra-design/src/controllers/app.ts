import { importFeature } from '@asyra/core'
import { app, setPixiApp } from '../states/app'
import { FeatureNames, PrimaryToolType } from '../constants'
import core from '../contexts'

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
    const featureAPI = importFeature(FeatureNames.SWITCH_PRIMARY_TOOL)

    if (featureAPI?.switch) {
      const switchFn = featureAPI.switch as (tool: string) => void
      switchFn(primaryTool)
    }
  } catch (error) {
    console.error('[app.controller.switchPrimaryTool] Error:', error)
  }
}
