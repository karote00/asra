export interface RenderRawAPIs {
  initRender: (
    width: number,
    height: number,
    color: number
  ) => Promise<HTMLCanvasElement | null>
  renderIsReady: () => void
}

export type RenderAPIs = RenderRawAPIs
