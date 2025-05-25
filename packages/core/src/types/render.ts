export interface RenderRawAPIs {
  renderIsReady: () => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initRender: (width: number, height: number, color: number) => Promise<any>
}

export type RenderAPIs = RenderRawAPIs
