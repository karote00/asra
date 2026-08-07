export const AI_DOCUMENT_INTERACTION_TARGET_ATTRIBUTE =
  'data-ai-interaction-target'

export const AiDocumentInteractionTargets = Object.freeze({
  AGENT_CANCEL: 'agent-cancel',
  VIEWPORT_NAVIGATION: 'viewport-navigation'
} as const)

export const AiDocumentInteractionTargetProps = Object.freeze({
  AGENT_CANCEL: Object.freeze({
    [AI_DOCUMENT_INTERACTION_TARGET_ATTRIBUTE]:
      AiDocumentInteractionTargets.AGENT_CANCEL
  }),
  VIEWPORT_NAVIGATION: Object.freeze({
    [AI_DOCUMENT_INTERACTION_TARGET_ATTRIBUTE]:
      AiDocumentInteractionTargets.VIEWPORT_NAVIGATION
  })
})
