import * as PIXI from 'pixi.js'
import { app, setPixiApp } from '../states/app'

export const initPixiApp = async (
  container: HTMLDivElement,
  width: number,
  height: number
) => {
  let newApp
  if (container) {
    newApp = new PIXI.Application()

    await newApp.init({
      width,
      height,
      backgroundColor: 0x1099bb,
      resolution: window.devicePixelRatio || 1,
      antialias: true,
      autoDensity: true
    } as any)

    if (!container.children.length) {
      container.appendChild(newApp.canvas as HTMLCanvasElement)
      setPixiApp(newApp)
    }
  }
}

export const destroyPixiApp = () => {
  if (!app.value) {
    return
  }

  setPixiApp(null)
  app.value.destroy(true, {
    children: true,
    texture: true
  })
}
