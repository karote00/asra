import { MouseSnapshot } from '@asra/utils'

export interface MouseStateRawAPIs {
  getMouseState: () => MouseSnapshot
}

export interface MouseStateActionAPIs {
  updateMouseState: (mouseSnapshot: MouseSnapshot) => void
}

export type MouseStateAPIs = MouseStateActionAPIs & MouseStateRawAPIs
