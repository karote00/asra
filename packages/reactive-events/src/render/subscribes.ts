import type { EmitInitRenderEvent, InitRenderEvent } from './events.js'
import { createSubscribeEvent } from '../event-bus.js'
import { EventTypes } from '../types.js'

export const subscribeToInitRender = createSubscribeEvent<InitRenderEvent>(
  EventTypes.INIT_RENDER
)

export const subscribeToEmitInitRender =
  createSubscribeEvent<EmitInitRenderEvent>(EventTypes.EMIT_INIT_RENDER)
