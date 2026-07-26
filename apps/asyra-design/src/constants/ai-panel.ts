export const AiPanelCommandIds = {
  TOGGLE: 'toggle-agent-panel'
} as const

export type AiPanelCommand =
  (typeof AiPanelCommandIds)[keyof typeof AiPanelCommandIds]
