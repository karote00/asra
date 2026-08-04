import { MapRegistry } from '@asyra/utils'
import type { PositionData } from '@asyra/utils'
import type {
  RenderInteractionTarget,
  RenderInteractionTargetBounds,
  RenderInteractionTargetSpace
} from '../types/render-interaction.js'

type StoredTarget = RenderInteractionTarget & { __order: number }

export interface InteractionTargetPositions {
  canvas: PositionData
  workspace: PositionData
}

export interface RegisterInteractionTargetOptions {
  override?: boolean
}

const isPointWithinBounds = (
  point: PositionData,
  bounds: RenderInteractionTargetBounds
) => {
  return (
    point.x >= bounds.minX &&
    point.x <= bounds.maxX &&
    point.y >= bounds.minY &&
    point.y <= bounds.maxY
  )
}

const resolveSpacePoint = (
  target: RenderInteractionTarget,
  positions: InteractionTargetPositions
) => {
  const space: RenderInteractionTargetSpace = target.space ?? 'canvas'
  return space === 'workspace' ? positions.workspace : positions.canvas
}

class InteractionTargetRegistry {
  private targets = new MapRegistry<string, StoredTarget>()
  private order = 0
  private sortedTargets: StoredTarget[] = []
  private dirty = false

  register(
    target: RenderInteractionTarget,
    options: RegisterInteractionTargetOptions = {}
  ): void {
    const existing = this.targets.get(target.id)
    const order = existing?.__order ?? this.order++
    const entry: StoredTarget = { ...target, __order: order }

    if (options.override) {
      this.targets.set(target.id, entry, { override: true })
    } else {
      this.targets.register(target.id, entry, {
        duplicateErrorMessage: `Render interaction target "${target.id}" is already registered`
      })
    }

    this.dirty = true
  }

  registerMany(
    targets: RenderInteractionTarget[],
    options: RegisterInteractionTargetOptions = {}
  ): void {
    targets.forEach((target) => this.register(target, options))
  }

  update(
    targetId: string,
    patch:
      | Partial<RenderInteractionTarget>
      | ((current: RenderInteractionTarget) => Partial<RenderInteractionTarget>)
  ): void {
    const current = this.targets.get(targetId)
    if (!current) {
      console.warn(
        `[render] Render interaction target "${targetId}" not found for update.`
      )
      return
    }

    const nextPatch = typeof patch === 'function' ? patch(current) : patch
    const next: StoredTarget = {
      ...current,
      ...nextPatch,
      id: current.id,
      __order: current.__order
    }

    this.targets.set(targetId, next, { override: true })
    this.dirty = true
  }

  unregister(targetId: string): boolean {
    const removed = this.targets.delete(targetId)
    if (removed) {
      this.dirty = true
    }
    return removed
  }

  clear(): void {
    this.targets.clear()
    this.sortedTargets = []
    this.dirty = false
  }

  get(targetId: string): RenderInteractionTarget | undefined {
    const target = this.targets.get(targetId)
    if (!target) {
      return
    }
    const { __order, ...rest } = target
    return { ...rest }
  }

  getAll(): RenderInteractionTarget[] {
    return this.getSortedTargets().map((target) => {
      const { __order, ...rest } = target
      return { ...rest }
    })
  }

  getSortedTargets(): StoredTarget[] {
    if (!this.dirty && this.sortedTargets.length > 0) {
      return this.sortedTargets
    }

    this.sortedTargets = this.targets.values().sort((a, b) => {
      const zIndexDiff = (b.zIndex ?? 0) - (a.zIndex ?? 0)
      if (zIndexDiff !== 0) {
        return zIndexDiff
      }
      return b.__order - a.__order
    })
    this.dirty = false
    return this.sortedTargets
  }

  hitTest(
    positions: InteractionTargetPositions
  ): RenderInteractionTarget | null {
    const targets = this.getSortedTargets()
    for (const target of targets) {
      const point = resolveSpacePoint(target, positions)
      if (target.bounds && !isPointWithinBounds(point, target.bounds)) {
        continue
      }
      if (target.hitTest && !target.hitTest(point)) {
        continue
      }
      const { __order, ...rest } = target
      return { ...rest }
    }
    return null
  }

  hitTestAll(positions: InteractionTargetPositions): RenderInteractionTarget[] {
    const hits: RenderInteractionTarget[] = []
    const targets = this.getSortedTargets()

    for (const target of targets) {
      const point = resolveSpacePoint(target, positions)
      if (target.bounds && !isPointWithinBounds(point, target.bounds)) {
        continue
      }
      if (target.hitTest && !target.hitTest(point)) {
        continue
      }
      const { __order, ...rest } = target
      hits.push({ ...rest })
    }

    return hits
  }
}

export const interactionTargetRegistry = new InteractionTargetRegistry()
export default interactionTargetRegistry
