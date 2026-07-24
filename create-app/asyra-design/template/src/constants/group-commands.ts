export const GroupCommandIds = {
  GROUP: 'group',
  UNGROUP: 'ungroup'
} as const

export type GroupCommand =
  (typeof GroupCommandIds)[keyof typeof GroupCommandIds]

export const GroupCommandPlatforms = {
  MACOS: 'macos',
  WINDOWS_LINUX: 'windows-linux'
} as const

export type GroupCommandPlatform =
  (typeof GroupCommandPlatforms)[keyof typeof GroupCommandPlatforms]
