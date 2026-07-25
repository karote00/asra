import type {
  AiConfirmationHandler,
  AiPlanPreview
} from '@asyra/ai-agent-runtime'

export type AsyraDesignAiConfirmationRequest = (
  preview: AiPlanPreview,
  options: { signal: AbortSignal }
) => Promise<boolean>

const cancelByDefault: AsyraDesignAiConfirmationRequest = async () => false

export const createAsyraDesignAiConfirmationHandler = (
  requestConfirmation: AsyraDesignAiConfirmationRequest = cancelByDefault
): AiConfirmationHandler =>
  Object.freeze({
    confirm: (preview: AiPlanPreview, options: { signal: AbortSignal }) =>
      requestConfirmation(preview, options)
  })
