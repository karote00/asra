import type { LayerPointerTarget } from './layer-pointer-session'

type ElementFromPoint = (clientX: number, clientY: number) => Element | null

export const resolveLayerPointerTarget = (
  clientX: number,
  clientY: number,
  elementFromPoint: ElementFromPoint
): LayerPointerTarget | null => {
  const pointedElement = elementFromPoint(clientX, clientY)
  if (!pointedElement) {
    return null
  }

  const row = pointedElement.closest<HTMLElement>('[data-layer-element-id]')
  if (row) {
    const elementId = row.dataset.layerElementId
    if (!elementId) {
      return null
    }

    const bounds = row.getBoundingClientRect()
    if (!Number.isFinite(bounds.height) || bounds.height <= 0) {
      return null
    }
    const relativeY = Math.max(
      0,
      Math.min(bounds.height, clientY - bounds.top)
    )
    const isGroup = row.dataset.layerIsGroup === 'true'
    const zone = isGroup
      ? relativeY < bounds.height / 3
        ? 'before'
        : relativeY > (bounds.height * 2) / 3
          ? 'after'
          : 'inside'
      : relativeY < bounds.height / 2
        ? 'before'
        : 'after'

    return {
      kind: 'row',
      elementId,
      zone
    }
  }

  return pointedElement.closest('[data-layer-drop-workspace="true"]')
    ? { kind: 'workspace' }
    : null
}
