import {
  clampUnit,
  type EVENT_OPTIONS,
  type FillAttrs,
  type FillGradientData,
  type FillGradientStop,
  type FillGradientType
} from '@asyra/utils'
import { isEqual } from 'lodash'
import { useEffect, useMemo, useRef, useState } from 'react'
import type React from 'react'
import type { FillPatch } from '../../common-apis'
import { systemContextApis } from '../../common-apis'
import { convertUserColorToDefault } from './color-format'
import { applyFillPatch, getChangedFillPatch, hasFillPatch } from './fill-patch'
import { sortGradientStopsForPreview } from './gradient-stops'

const DRAG_EPSILON = 0.0001

interface UseGradientInteractionsArgs {
  fill: FillAttrs
  fillId: string
  ownerElementId: string | null
  gradient: FillGradientData
  onChangeFill: (
    patch: FillPatch,
    options?: EVENT_OPTIONS,
    sourceFill?: FillAttrs
  ) => void
  onStartInteraction: () => void
  onEndInteraction: () => void
}

export const useGradientInteractions = ({
  fill,
  fillId,
  ownerElementId,
  gradient,
  onChangeFill,
  onStartInteraction,
  onEndInteraction
}: UseGradientInteractionsArgs) => {
  const [selectedStopIndex, setSelectedStopIndex] = useState(0)
  const [openStopIndex, setOpenStopIndex] = useState<number | null>(null)
  const stripRef = useRef<HTMLDivElement | null>(null)
  const draggingStopIndexRef = useRef<number | null>(null)
  const isDraggingRef = useRef(false)
  const fillRef = useRef(fill)
  const interactionStartFillRef = useRef<FillAttrs | null>(null)
  const interactionLatestFillRef = useRef<FillAttrs | null>(null)
  const lastStopsRef = useRef(gradient.gradientStops)
  const dragFrameRef = useRef<number | null>(null)
  const pendingClientXRef = useRef<number | null>(null)
  const dragRectRef = useRef<{ left: number; width: number } | null>(null)

  const orderedStops = useMemo(
    () => sortGradientStopsForPreview(gradient.gradientStops),
    [gradient.gradientStops]
  )

  useEffect(() => {
    fillRef.current = fill
  }, [fill])

  useEffect(() => {
    const prevStops = lastStopsRef.current
    lastStopsRef.current = gradient.gradientStops

    // Find if a stop was re-added (e.g. Redo) or added
    if (gradient.gradientStops.length > prevStops.length) {
      if (isDraggingRef.current) return

      // Find the first index where they differ or the first added index
      let addedIndex = -1
      for (let i = 0; i < gradient.gradientStops.length; i++) {
        if (
          i >= prevStops.length ||
          !isEqual(gradient.gradientStops[i], prevStops[i])
        ) {
          addedIndex = i
          break
        }
      }

      if (addedIndex !== -1) {
        setSelectedStopIndex(addedIndex)
      }
    }
  }, [gradient.gradientStops])

  useEffect(() => {
    if (selectedStopIndex < gradient.gradientStops.length) {
      return
    }

    setSelectedStopIndex(Math.max(0, gradient.gradientStops.length - 1))
  }, [gradient.gradientStops.length, selectedStopIndex])

  useEffect(() => {
    if (openStopIndex === null) {
      return
    }

    if (openStopIndex < gradient.gradientStops.length) {
      return
    }

    setOpenStopIndex(
      gradient.gradientStops.length
        ? Math.max(0, gradient.gradientStops.length - 1)
        : null
    )
  }, [gradient.gradientStops.length, openStopIndex])

  useEffect(() => {
    if (ownerElementId) {
      systemContextApis.setSelectedGradientStop({
        elementId: ownerElementId,
        fillId: fillId,
        stopIndex: selectedStopIndex
      })
    }

    return () => {
      if (ownerElementId) {
        systemContextApis.setSelectedGradientStop(null)
      }
    }
  }, [fillId, ownerElementId, selectedStopIndex])

  const startInteractionSession = () => {
    const currentFill = fillRef.current
    if (isDraggingRef.current || !currentFill) {
      return
    }

    isDraggingRef.current = true
    interactionStartFillRef.current = currentFill
    interactionLatestFillRef.current = currentFill
    onStartInteraction()
  }

  const commitInteractionFill = (
    patch: FillPatch,
    options?: EVENT_OPTIONS,
    sourceFill?: FillAttrs
  ) => {
    const currentFill = sourceFill ?? fillRef.current
    if (!currentFill || !hasFillPatch(patch)) {
      return
    }

    const nextFill = applyFillPatch(currentFill, patch)
    interactionLatestFillRef.current = nextFill

    if (isDraggingRef.current) {
      onChangeFill(
        patch,
        {
          ...(options ?? {}),
          undoable: false,
          sharedDelivery: 'immediate'
        },
        sourceFill
      )
      return
    }

    onChangeFill(patch, options, currentFill)
  }

  const endInteractionSession = () => {
    if (!isDraggingRef.current) {
      return
    }

    const startFill = interactionStartFillRef.current
    const resolvedFinalFill =
      interactionLatestFillRef.current ?? fillRef.current

    if (
      startFill &&
      resolvedFinalFill &&
      !isEqual(startFill, resolvedFinalFill)
    ) {
      onChangeFill(
        getChangedFillPatch(resolvedFinalFill, startFill),
        { undoable: false },
        resolvedFinalFill
      )
      onChangeFill(
        getChangedFillPatch(startFill, resolvedFinalFill),
        undefined,
        startFill
      )
    }

    isDraggingRef.current = false
    interactionStartFillRef.current = null
    interactionLatestFillRef.current = null
    onEndInteraction()
  }

  const applyGradientStops = (
    nextStops: FillGradientStop[],
    options?: EVENT_OPTIONS
  ) => {
    const sourceFill = fillRef.current
    const nextGradient: FillGradientData = {
      ...gradient,
      gradientStops: nextStops
    }

    commitInteractionFill(
      {
        color: nextStops[0]?.color ?? sourceFill.color,
        gradient: nextGradient
      },
      options,
      sourceFill
    )
  }

  const updateStop = (stopIndex: number, patch: Partial<FillGradientStop>) => {
    const nextStops = gradient.gradientStops.map((stop, currentIndex) =>
      currentIndex === stopIndex
        ? {
            ...stop,
            ...patch
          }
        : stop
    )
    applyGradientStops(nextStops)
  }

  const handleStopColorChange = (
    stopIndex: number,
    next: { color: string; opacity: number }
  ) => {
    const targetStop = gradient.gradientStops[stopIndex]
    if (!targetStop) {
      return
    }

    const nextColor = convertUserColorToDefault(
      next.color,
      fill.defaultColorFormat,
      targetStop.color
    )

    updateStop(stopIndex, {
      color: nextColor,
      opacity: next.opacity
    })
  }

  const handleStopPositionChange = (
    stopIndex: number,
    value: string
  ): boolean => {
    if (!gradient.gradientStops[stopIndex]) {
      return false
    }
    const parsed = Number.parseFloat(value)
    if (!Number.isFinite(parsed)) {
      return false
    }

    updateStop(stopIndex, {
      position: clampUnit(parsed / 100)
    })
    return true
  }

  const handleStopColorTextChange = (
    stopIndex: number,
    value: string
  ): boolean => {
    const targetStop = gradient.gradientStops[stopIndex]
    if (!targetStop) {
      return false
    }

    const nextColor = convertUserColorToDefault(
      value,
      fill.defaultColorFormat,
      targetStop.color
    )

    updateStop(stopIndex, {
      color: nextColor
    })
    return true
  }

  const handleStopOpacityChange = (
    stopIndex: number,
    value: string
  ): boolean => {
    const targetStop = gradient.gradientStops[stopIndex]
    if (!targetStop) {
      return false
    }

    const parsed = Number.parseFloat(value)
    if (!Number.isFinite(parsed)) {
      return false
    }

    updateStop(stopIndex, {
      opacity: clampUnit(parsed / 100)
    })
    return true
  }

  const appendStop = (position: number, seedIndex?: number) => {
    const seedStop =
      (seedIndex !== undefined ? gradient.gradientStops[seedIndex] : null) ??
      gradient.gradientStops[selectedStopIndex] ??
      gradient.gradientStops[0]
    const nextStops = [...gradient.gradientStops]
    nextStops.push({
      position,
      color: seedStop?.color ?? fill.color,
      opacity: seedStop?.opacity ?? 1
    })
    applyGradientStops(nextStops)
    setSelectedStopIndex(nextStops.length - 1)
  }

  const handleAddStop = (clientX: number) => {
    const rect = stripRef.current?.getBoundingClientRect()
    if (!rect) {
      return
    }

    appendStop(clampUnit((clientX - rect.left) / rect.width))
  }

  const handleAddStopFromButton = () => {
    const selectedOrderIndex = orderedStops.findIndex(
      ({ index: stopIndex }) => stopIndex === selectedStopIndex
    )
    const currentEntry =
      orderedStops[
        selectedOrderIndex >= 0 ? selectedOrderIndex : orderedStops.length - 1
      ]
    let nextEntryIndex = -1
    if (selectedOrderIndex > 0) {
      nextEntryIndex = selectedOrderIndex
    }
    if (
      selectedOrderIndex >= 0 &&
      selectedOrderIndex < orderedStops.length - 1
    ) {
      nextEntryIndex = selectedOrderIndex + 1
    }
    const nextEntry = orderedStops[nextEntryIndex]

    const nextPosition = nextEntry
      ? clampUnit((currentEntry.stop.position + nextEntry.stop.position) / 2)
      : clampUnit(
          currentEntry.stop.position + (1 - currentEntry.stop.position) / 2
        )

    appendStop(nextPosition, currentEntry.index)
  }

  const handleRemoveStop = (stopIndex: number) => {
    if (gradient.gradientStops.length <= 2) {
      return
    }

    const nextStops = gradient.gradientStops.filter(
      (_, currentIndex) => currentIndex !== stopIndex
    )
    applyGradientStops(nextStops)
    setSelectedStopIndex((currentSelected) => {
      if (currentSelected === stopIndex) {
        return Math.max(0, stopIndex - 1)
      }

      return currentSelected > stopIndex ? currentSelected - 1 : currentSelected
    })
  }

  const handleGradientTypeChange = (nextGradientType: FillGradientType) => {
    if (gradient.gradientType === nextGradientType) {
      return
    }

    onChangeFill({
      gradient: {
        ...gradient,
        gradientType: nextGradientType
      },
      color: gradient.gradientStops[0]?.color ?? fill.color
    })
  }

  const handleFlipGradient = () => {
    const nextStops = gradient.gradientStops
      .map((stop) => ({
        ...stop,
        position: clampUnit(1 - stop.position)
      }))
      .reverse()
    const nextHandles = gradient.gradientHandles
      .map((handle) => ({
        x: clampUnit(1 - handle.x),
        y: clampUnit(1 - handle.y)
      }))
      .reverse()

    onChangeFill({
      gradient: {
        ...gradient,
        gradientStops: nextStops,
        gradientHandles: nextHandles
      },
      color: nextStops[0]?.color ?? fill.color
    })
  }

  const updateStopPositionFromClientX = (clientX: number) => {
    const draggingIndex = draggingStopIndexRef.current
    const rect =
      dragRectRef.current ?? stripRef.current?.getBoundingClientRect()
    if (!rect || draggingIndex === null) {
      return
    }

    const position = clampUnit((clientX - rect.left) / rect.width)
    const currentStop = gradient.gradientStops[draggingIndex]
    if (
      currentStop &&
      Math.abs(currentStop.position - position) <= DRAG_EPSILON
    ) {
      return
    }

    const nextStops = gradient.gradientStops.map((stop, currentIndex) =>
      currentIndex === draggingIndex
        ? {
            ...stop,
            position
          }
        : stop
    )
    applyGradientStops(nextStops)
  }

  const scheduleStopPositionUpdate = (clientX: number) => {
    pendingClientXRef.current = clientX
    if (dragFrameRef.current !== null) {
      return
    }

    dragFrameRef.current = requestAnimationFrame(() => {
      dragFrameRef.current = null
      const pending = pendingClientXRef.current
      pendingClientXRef.current = null
      if (pending === null) {
        return
      }
      updateStopPositionFromClientX(pending)
    })
  }

  const flushStopPositionUpdate = () => {
    if (dragFrameRef.current !== null) {
      cancelAnimationFrame(dragFrameRef.current)
      dragFrameRef.current = null
    }
    const pending = pendingClientXRef.current
    pendingClientXRef.current = null
    if (pending !== null) {
      updateStopPositionFromClientX(pending)
    }
  }

  const beginStopDrag = (
    stopIndex: number,
    event: React.PointerEvent<HTMLButtonElement>
  ) => {
    event.preventDefault()
    event.stopPropagation()
    setSelectedStopIndex(stopIndex)
    draggingStopIndexRef.current = stopIndex
    const rect = stripRef.current?.getBoundingClientRect()
    dragRectRef.current = rect ? { left: rect.left, width: rect.width } : null

    if (!isDraggingRef.current) {
      startInteractionSession()
    }

    updateStopPositionFromClientX(event.clientX)

    const handlePointerMove = (pointerEvent: PointerEvent) => {
      scheduleStopPositionUpdate(pointerEvent.clientX)
    }

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
      draggingStopIndexRef.current = null
      dragRectRef.current = null
      flushStopPositionUpdate()

      endInteractionSession()
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)
  }

  const handleSelectStop = (stopIndex: number) => {
    setSelectedStopIndex(stopIndex)
    if (openStopIndex !== null) {
      setOpenStopIndex(stopIndex)
    }
  }

  const handleStopRowPointerDown = (
    stopIndex: number,
    event: React.PointerEvent
  ) => {
    if (openStopIndex === null) {
      return
    }

    setSelectedStopIndex(stopIndex)
    setOpenStopIndex(stopIndex)
    event.stopPropagation()
  }

  const handleOpenStopChange = (stopIndex: number, open: boolean) => {
    setOpenStopIndex(open ? stopIndex : null)
  }

  return {
    stripRef,
    orderedStops,
    selectedStopIndex,
    openStopIndex,
    startInteractionSession,
    endInteractionSession,
    handleGradientTypeChange,
    handleFlipGradient,
    handleAddStop,
    handleAddStopFromButton,
    beginStopDrag,
    handleSelectStop,
    handleStopRowPointerDown,
    handleStopPositionChange,
    handleStopColorChange,
    handleStopColorTextChange,
    handleStopOpacityChange,
    handleRemoveStop,
    handleOpenStopChange
  }
}
