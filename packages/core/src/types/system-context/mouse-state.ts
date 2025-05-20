import { MouseState } from '@asra/utils'

export interface MouseStateActionAPIs {
  updateMouseState: (mouseStae: MouseState) => void
}

export type MouseStateAPIs = MouseStateActionAPIs
