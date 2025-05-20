import { MouseSnapshot } from '@asra/utils'

export interface MouseStateActionAPIs {
  updateMouseState: (mouseSnapshot: MouseSnapshot) => void
}

export type MouseStateAPIs = MouseStateActionAPIs
