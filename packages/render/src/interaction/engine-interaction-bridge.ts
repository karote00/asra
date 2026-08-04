import type {
  RenderEngineInteractionEvent,
  RenderEngineObjectHandle
} from '@asyra/render-engine'
import { ElementInteractionHandlers } from '../handlers/index.js'

type EngineInteractionTargetResolver = (
  handle: RenderEngineObjectHandle | null
) => string | null

export class RenderEngineInteractionBridge {
  constructor(
    private readonly resolveTarget: EngineInteractionTargetResolver
  ) {}

  handle(event: RenderEngineInteractionEvent): void {
    if (event.type !== 'pointerover' && event.type !== 'pointerout') {
      return
    }

    const targetId = this.resolveTarget(event.target)
    if (!targetId) {
      return
    }

    if (event.type === 'pointerover') {
      ElementInteractionHandlers.handlePointerHover(targetId)
      return
    }

    ElementInteractionHandlers.handlePointerLeave(targetId)
  }
}

export default RenderEngineInteractionBridge
