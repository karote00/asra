import { KeySnapshot } from '@asra/utils'

export interface KeyStateRawAPIs {
  getKeyState: () => KeySnapshot
}

export interface KeyStateActionAPIs {
  updateKeyState: (keySnapshot: KeySnapshot) => void
}

export type KeyStateAPIs = KeyStateActionAPIs & KeyStateRawAPIs
