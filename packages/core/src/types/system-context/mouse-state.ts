import { MouseSnapshot } from '@asyra/utils'

export interface MouseStateActionAPIs {
  updateMouseState: (mouseSnapshot: MouseSnapshot) => void
}

export type MouseStateAPIs = MouseStateActionAPIs
