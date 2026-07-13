export const SharedDataChannelNames = {
  SCENE_TREE: 'sceneTree',
  SELECTION: 'selection',
  PROPS: 'props'
} as const

export type SharedDataChannelName =
  (typeof SharedDataChannelNames)[keyof typeof SharedDataChannelNames]
