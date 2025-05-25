import { InteractionActions, InteractionEvent } from '@asra/utils'
import { PrimaryToolHandlers } from './primary-tool'
import { ElementHandlers } from './element'

export const InteractionCoreHandlers: Record<
  InteractionActions,
  (payload?: InteractionEvent['payload']) => void
> = {
  ...PrimaryToolHandlers,
  ...ElementHandlers
}
