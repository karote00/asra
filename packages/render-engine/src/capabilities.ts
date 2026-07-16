import { UnsupportedRenderEngineCapabilityError } from './errors'
import type { RenderEngine, RenderEngineCapability } from './types'

export const RenderEngineCapabilities = {
  OBJECTS: 'objects',
  GRAPHICS: 'graphics',
  INTERACTION: 'interaction',
  RESOURCES: 'resources'
} as const satisfies Record<string, RenderEngineCapability>

export function assertRenderEngineCapabilities(
  engine: Pick<RenderEngine, 'name' | 'capabilities'>,
  requiredCapabilities: readonly RenderEngineCapability[]
): void {
  const missingCapabilities = requiredCapabilities.filter(
    (capability) => !engine.capabilities.has(capability)
  )

  if (missingCapabilities.length > 0) {
    throw new UnsupportedRenderEngineCapabilityError(
      engine.name,
      missingCapabilities
    )
  }
}
