interface VisibleRangeSelectionInput {
  canonicalIds: readonly string[]
  visibleIds: readonly string[]
  selectedIds: ReadonlySet<string>
  anchorId: string | null
  clickedId: string
}

interface VisibleRangeSelectionResult {
  selectedIds: string[]
  anchorId: string
}

export const getVisibleRangeSelection = ({
  canonicalIds,
  visibleIds,
  selectedIds,
  anchorId,
  clickedId
}: VisibleRangeSelectionInput): VisibleRangeSelectionResult | null => {
  const clickedIndex = visibleIds.indexOf(clickedId)
  if (clickedIndex === -1) {
    return null
  }

  const nextSelection = new Set(selectedIds)
  const visibleAnchorId =
    anchorId && selectedIds.has(anchorId) && visibleIds.includes(anchorId)
      ? anchorId
      : (visibleIds.find((id) => selectedIds.has(id)) ?? null)

  if (!visibleAnchorId) {
    nextSelection.add(clickedId)
  } else {
    const anchorIndex = visibleIds.indexOf(visibleAnchorId)
    const start = Math.min(anchorIndex, clickedIndex)
    const end = Math.max(anchorIndex, clickedIndex)
    for (let index = start; index <= end; index += 1) {
      nextSelection.add(visibleIds[index])
    }
  }

  return {
    selectedIds: canonicalIds.filter((id) => nextSelection.has(id)),
    anchorId: clickedId
  }
}
