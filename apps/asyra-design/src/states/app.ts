import { signal } from '@preact/signals-react'

type AppType = { destroy: (...args: unknown[]) => void } | null

export const app = signal<AppType>(null)
export const setPixiApp = (newApp: AppType): void => {
  if (newApp) {
    app.value = newApp
  }
}

export const canvasWidth = signal<number>(window.innerWidth)
export const canvasHeight = signal<number>(window.innerHeight)
