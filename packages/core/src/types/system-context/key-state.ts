import { KeySnapshot } from '@asra/utils'

export interface KeyStateActionAPIs {
  updateKeyState: (keySnapshot: KeySnapshot) => void
}

export type KeyStateAPIs = KeyStateActionAPIs
