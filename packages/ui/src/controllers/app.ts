import * as PIXI from 'pixi.js'
import Render from '@asra/render'
import { app, setPixiApp } from '../states/app'

const render = new Render()

export const initPixiApp = async (
  container: HTMLDivElement,
  width: number,
  height: number
) => {
  let newApp
  if (container) {
    newApp = await render.init(width, height, 0x1099bb)

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
