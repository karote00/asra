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
import {
  convertStoredColorToFormat,
  convertUserColorToDefault
} from './color-format'
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
    if (!isEqual(sourceFill[key], nextFill[key])) {
      patch[key] = nextFill[key]
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
  const colorPickerTransactionRef = useRef(false)
  const pickerFillRef = useRef<FillAttrs | null>(fill)
  const pickerStartFillRef = useRef<FillAttrs | null>(null)
  const pickerLatestFillRef = useRef<FillAttrs | null>(null)

  useEffect(() => {
    pickerFillRef.current = fill
  }, [fill])

  const gradientData = useMemo(() => {
    if (!fill || fill.kind !== FillKinds.GRADIENT || !fill.gradient) {
      return null
    }

    return fill.gradient
  }, [fill])

  const displayColor = useMemo(
    () =>
      fill ? convertStoredColorToFormat(fill.color, fill.colorFormat) : '',
    [fill]
  )

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
    transactionApis.startTransaction()
    try {
      callback()
    } finally {
      transactionApis.endTransaction()
    }
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
      writePickerFill(next.color, next.opacity, { undoable: false })
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
    startFillInteractionTransaction,
    endFillInteractionTransaction
  }
}
