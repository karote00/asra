import {
  isAiDrawingProgressStateOrNull,
  type AiDrawingProgressState
} from '../../common-apis/system-context'
import { AsyraDesignSystemPropertyKeys } from '../../constants'
import core from '../../contexts'

let hasInit = false

export const initAiDrawingProgress = (): void => {
  if (hasInit) {
    return
  }

  core.defineSystemProperty<AiDrawingProgressState | null>(
    AsyraDesignSystemPropertyKeys.AI_DRAWING_PROGRESS,
    null,
    {
      runtime: true,
      validate: isAiDrawingProgressStateOrNull
    }
  )

  hasInit = true
}
