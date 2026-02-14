export interface RenderRawAPIs {
  initRender: (width: number, height: number, color: number) => Promise<unknown>
  renderIsReady: () => void
}

export type RenderAPIs = RenderRawAPIs
