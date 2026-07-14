import {
  FillKinds,
  createDefaultGradientData,
  type FillAttrs,
  type FillColorFormat,
  type EVENT_OPTIONS
} from '@asyra/utils'
import { isEqual } from 'lodash'
import { useEffect, useMemo, useRef } from 'react'
import { fillApis, transactionApis, type FillPatch } from '../../common-apis'
import { ALLOWED_COLOR_FORMATS, FILL_PATCH_KEYS } from '../../constants'
import { systemContextApis } from '../../common-apis'
import { convertUserColorToDefault, convertToHexUpper } from './color-format'
import { toGradientPreviewCss } from './gradient-preview'

const hasFillPatch = (patch: FillPatch) => Object.keys(patch).length > 0

const applyFillPatch = (
  sourceFill: FillAttrs,
  patch: FillPatch
): FillAttrs => ({
  ...sourceFill,
  ...patch
})

const getChangedFillPatch = (
  sourceFill: FillAttrs,
  nextFill: FillAttrs
): FillPatch =>
  FILL_PATCH_KEYS.reduce<FillPatch>((patch, key) => {
    const nextValue = nextFill[key]
    if (!isEqual(sourceFill[key], nextValue)) {
      Object.assign(patch, { [key]: nextValue })
    }

    return patch
  }, {})

const createColorPatch = (sourceFill: FillAttrs, color: string): FillPatch => {
  const patch: FillPatch = {}

  if (!isEqual(sourceFill.color, color)) {
    patch.color = color
  }

  if (sourceFill.kind !== FillKinds.GRADIENT || !sourceFill.gradient) {
    return patch
  }

  const [firstStop, ...restStops] = sourceFill.gradient.gradientStops
  const nextFirstStop = firstStop
    ? {
        ...firstStop,
        color
      }
    : {
        position: 0,
        color,
        opacity: 1
      }

  const nextGradient = {
    ...sourceFill.gradient,
    gradientStops: [nextFirstStop, ...restStops]
  }

  if (!isEqual(sourceFill.gradient, nextGradient)) {
    patch.gradient = nextGradient
  }

  return patch
}

const createPickerPatch = (
  sourceFill: FillAttrs,
  color: string,
  opacity: number
): FillPatch => {
  const nextColor = convertUserColorToDefault(
    color,
    sourceFill.defaultColorFormat,
    sourceFill.color
  )

  const patch = createColorPatch(sourceFill, nextColor)
  if (!isEqual(sourceFill.opacity, opacity)) {
    patch.opacity = opacity
  }

  return patch
}

const createKindPatch = (
  sourceFill: FillAttrs,
  nextKind: FillAttrs['kind']
): FillPatch => {
  if (sourceFill.kind === nextKind) {
    return {}
  }

  if (nextKind !== FillKinds.GRADIENT) {
    return {
      kind: nextKind
    }
  }

  const baseGradient = sourceFill.gradient ?? createDefaultGradientData()
  const [firstStop, ...restStops] = baseGradient.gradientStops
  const seededFirstStop = firstStop
    ? {
        ...firstStop,
        color: sourceFill.color
      }
    : {
        position: 0,
        color: sourceFill.color,
        opacity: 1
      }

  return {
    kind: nextKind,
    gradient: {
      ...baseGradient,
      gradientStops: [seededFirstStop, ...restStops]
    }
  }
}

interface UseFillInteractionsArgs {
  fill: FillAttrs | null
  fillId: string
  ownerElementId: string | null
}

export const useFillInteractions = ({
  fill,
  fillId,
  ownerElementId
}: UseFillInteractionsArgs) => {
  const isColorPickerOpenRef = useRef(false)
  const colorPickerTransactionRef = useRef(false)
  const pickerFillRef = useRef<FillAttrs | null>(fill)
  const pickerStartFillRef = useRef<FillAttrs | null>(null)
  const pickerLatestFillRef = useRef<FillAttrs | null>(null)

  useEffect(() => {
    pickerFillRef.current = fill
  }, [fill])

  useEffect(() => {
    const activeGradientFill = systemContextApis.getActiveGradientFill()
    if (!activeGradientFill) {
      return
    }

    const isCurrentFillActive =
      activeGradientFill.elementId === ownerElementId &&
      activeGradientFill.fillId === fillId

    if (!isCurrentFillActive) {
      return
    }

    if (fill?.kind === FillKinds.GRADIENT) {
      return
    }

    systemContextApis.clearGradientFillEditingState()
  }, [fill, fillId, ownerElementId])

  useEffect(
    () => () => {
      const activeGradientFill = systemContextApis.getActiveGradientFill()
      if (
        activeGradientFill?.elementId === ownerElementId &&
        activeGradientFill.fillId === fillId
      ) {
        systemContextApis.clearGradientFillEditingState()
      }
    },
    [fillId, ownerElementId]
  )

  const gradientData = useMemo(() => {
    if (!fill || fill.kind !== FillKinds.GRADIENT || !fill.gradient) {
      return null
    }

    return fill.gradient
  }, [fill])

  const displayColor = useMemo(() => {
    if (!fill) {
      return ''
    }

    return convertToHexUpper(fill.color)
  }, [fill])

  const previewSwatchStyle = useMemo(
    () =>
      gradientData
        ? {
            backgroundImage: toGradientPreviewCss(gradientData)
          }
        : undefined,
    [gradientData]
  )

  const commitFillPatch = (
    patch: FillPatch,
    options?: EVENT_OPTIONS,
    sourceFill?: FillAttrs | null
  ) => {
    const currentFill = sourceFill ?? fill
    if (!currentFill || !ownerElementId || !hasFillPatch(patch)) {
      return
    }

    fillApis.updateFillFields(
      ownerElementId,
      fillId,
      currentFill,
      patch,
      options
    )
  }

  const runDiscreteFillInteraction = (callback: () => void) => {
    transactionApis.runTransaction(callback)
  }

  const commitFillInteractionPatch = (
    patch: FillPatch,
    options?: EVENT_OPTIONS,
    sourceFill?: FillAttrs | null
  ) => {
    if (colorPickerTransactionRef.current) {
      commitFillPatch(patch, options, sourceFill)
      return
    }

    runDiscreteFillInteraction(() => {
      commitFillPatch(patch, options, sourceFill)
    })
  }

  const writePickerFill = (
    color: string,
    opacity: number,
    options?: EVENT_OPTIONS
  ) => {
    const sourceFill = pickerFillRef.current
    if (!sourceFill) {
      return null
    }

    const patch = createPickerPatch(sourceFill, color, opacity)
    const nextFill = applyFillPatch(sourceFill, patch)
    pickerLatestFillRef.current = nextFill
    commitFillPatch(patch, options, sourceFill)
    return nextFill
  }

  const startFillInteractionTransaction = () => {
    const currentFill = pickerFillRef.current
    if (colorPickerTransactionRef.current || !currentFill) {
      return
    }

    colorPickerTransactionRef.current = true
    transactionApis.startTransaction()
  }

  const endFillInteractionTransaction = () => {
    if (!colorPickerTransactionRef.current) {
      return
    }

    colorPickerTransactionRef.current = false
    transactionApis.endTransaction()
  }

  const handleKindChange = (nextKind: FillAttrs['kind']) => {
    if (!fill) {
      return
    }

    commitFillInteractionPatch(createKindPatch(fill, nextKind))

    if (
      nextKind === FillKinds.GRADIENT &&
      isColorPickerOpenRef.current &&
      ownerElementId
    ) {
      systemContextApis.setActiveGradientFill({
        elementId: ownerElementId,
        fillId
      })
      return
    }

    const activeGradientFill = systemContextApis.getActiveGradientFill()
    if (
      nextKind !== FillKinds.GRADIENT &&
      activeGradientFill?.elementId === ownerElementId &&
      activeGradientFill.fillId === fillId
    ) {
      systemContextApis.clearGradientFillEditingState()
    }
  }

  const handleVisibleChange = (nextVisible: boolean) => {
    if (!fill || isEqual(fill.visible, nextVisible)) {
      return
    }

    commitFillInteractionPatch({
      visible: nextVisible
    })
  }

  const handleOpacityChange = (value: string): boolean => {
    const parsed = Number.parseFloat(value)
    if (!Number.isFinite(parsed)) {
      return false
    }

    const nextOpacity = Math.max(0, Math.min(100, parsed)) / 100
    if (!fill || isEqual(fill.opacity, nextOpacity)) {
      return false
    }

    commitFillInteractionPatch({
      opacity: nextOpacity
    })
    return true
  }

  const handleFormatChange = (nextFormat: FillColorFormat) => {
    if (!fill || isEqual(fill.colorFormat, nextFormat)) {
      return
    }

    if (!ALLOWED_COLOR_FORMATS.includes(nextFormat)) {
      return
    }

    commitFillInteractionPatch({
      colorFormat: nextFormat
    })
  }

  const handleColorValueChange = (value: string): boolean => {
    if (!fill) {
      return false
    }

    const nextColor = convertUserColorToDefault(
      value,
      fill.defaultColorFormat,
      fill.color
    )

    const patch = createColorPatch(fill, nextColor)
    if (!hasFillPatch(patch)) {
      return false
    }

    commitFillInteractionPatch(patch)
    return true
  }

  const handleColorPickerChange = (next: {
    color: string
    opacity: number
  }) => {
    if (colorPickerTransactionRef.current) {
      writePickerFill(next.color, next.opacity, {
        undoable: false,
        sharedDelivery: 'immediate'
      })
      return
    }

    runDiscreteFillInteraction(() => {
      writePickerFill(next.color, next.opacity)
    })
  }

  const handleColorPickerChangeStart = () => {
    const currentFill = pickerFillRef.current
    if (!currentFill) {
      return
    }

    pickerStartFillRef.current = currentFill
    pickerLatestFillRef.current = currentFill
    startFillInteractionTransaction()
  }

  const handleColorPickerChangeEnd = (next: {
    color: string
    opacity: number
  }) => {
    if (!colorPickerTransactionRef.current) {
      return
    }

    const startFill = pickerStartFillRef.current
    const finalPatch = startFill
      ? createPickerPatch(startFill, next.color, next.opacity)
      : null
    const finalFill =
      startFill && finalPatch
        ? applyFillPatch(startFill, finalPatch)
        : pickerLatestFillRef.current

    if (startFill && finalFill && !isEqual(startFill, finalFill)) {
      commitFillPatch(
        getChangedFillPatch(finalFill, startFill),
        { undoable: false },
        finalFill
      )
      commitFillPatch(finalPatch ?? {}, undefined, startFill)
    }

    pickerStartFillRef.current = null
    pickerLatestFillRef.current = null
    endFillInteractionTransaction()
  }

  const handleGradientFillChange = (
    patch: FillPatch,
    options?: EVENT_OPTIONS,
    sourceFill?: FillAttrs
  ) => {
    commitFillInteractionPatch(patch, options, sourceFill)
  }

  const handleGradientEditorOpenChange = (open: boolean) => {
    isColorPickerOpenRef.current = open

    if (open && fill?.kind === FillKinds.GRADIENT && ownerElementId) {
      systemContextApis.setActiveGradientFill({
        elementId: ownerElementId,
        fillId
      })
      return
    }

    const activeGradientFill = systemContextApis.getActiveGradientFill()
    if (
      activeGradientFill?.elementId === ownerElementId &&
      activeGradientFill.fillId === fillId
    ) {
      systemContextApis.clearGradientFillEditingState()
    }
  }

  return {
    displayColor,
    gradientData,
    previewSwatchStyle,
    handleKindChange,
    handleVisibleChange,
    handleOpacityChange,
    handleFormatChange,
    handleColorValueChange,
    handleColorPickerChange,
    handleColorPickerChangeStart,
    handleColorPickerChangeEnd,
    handleGradientFillChange,
    handleGradientEditorOpenChange,
    startFillInteractionTransaction,
    endFillInteractionTransaction
  }
}
