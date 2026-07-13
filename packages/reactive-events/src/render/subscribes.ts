import type { EmitInitRenderEvent, InitRenderEvent } from './events'
import { createSubscribeEvent } from '../event-bus'
import { EventTypes } from '../types'

export const subscribeToInitRender = createSubscribeEvent<InitRenderEvent>(
  EventTypes.INIT_RENDER
)

export const subscribeToEmitInitRender =
  createSubscribeEvent<EmitInitRenderEvent>(EventTypes.EMIT_INIT_RENDER)
