import { signal } from '@preact/signals-react'
import * as PIXI from 'pixi.js'

export const app = signal<PIXI.Application | null>(null)
export const setPixiApp = (newApp: any): void => {
  if (newApp) {
    app.value = newApp
  }
}

export const canvasWidth = signal<number>(window.innerWidth)
export const canvasHeight = signal<number>(window.innerHeight)
