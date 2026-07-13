import {
  type EVENT_OPTIONS,
  type FillColorFormat,
  type FillAttrs,
  type StrokeAttrs
} from '@asyra/utils'
import { isEqual } from 'lodash'
import { useEffect, useMemo, useRef } from 'react'
import {
  strokeApis,
  transactionApis,
  type StrokePatch
} from '../../common-apis'
import { ALLOWED_COLOR_FORMATS, STROKE_PATCH_KEYS } from '../../constants'
import { parseFiniteInputNumber } from '../number-input'
import {
  convertUserColorToDefault,
  convertToHexUpper
} from '../fills/color-format'
import {
  createStrokeStyleIntent,
  type StrokeStyleIntentPatch
} from './stroke-intents'

const hasStrokePatch = (patch: StrokePatch) => Object.keys(patch).length > 0

const applyStrokePatch = (
  sourceStroke: StrokeAttrs,
  patch: StrokePatch
): StrokeAttrs => ({
  ...sourceStroke,
  ...patch,
  fill: patch.fill ?? sourceStroke.fill
})

const getChangedStrokePatch = (
  sourceStroke: StrokeAttrs,
  nextStroke: StrokeAttrs
): StrokePatch =>
  STROKE_PATCH_KEYS.reduce<StrokePatch>((patch, key) => {
    const nextValue = nextStroke[key]
    if (!isEqual(sourceStroke[key], nextValue)) {
      Object.assign(patch, { [key]: nextValue })
    }

    return patch
  }, {})

const createFillPatch = (
  sourceStroke: StrokeAttrs,
  fillPatch: Partial<FillAttrs>
): StrokePatch => {
  const nextFill: FillAttrs = {
    ...sourceStroke.fill,
    ...fillPatch,
    id: sourceStroke.id,
    type: 'fill'
  }

  return isEqual(sourceStroke.fill, nextFill) ? {} : { fill: nextFill }
}

const createColorPatch = (
  sourceStroke: StrokeAttrs,
  color: string
): StrokePatch => {
  if (!isEqual(sourceStroke.fill.color, color)) {
    return createFillPatch(sourceStroke, { color })
  }

  return {}
}

const createPickerPatch = (
  sourceStroke: StrokeAttrs,
  color: string,
  opacity: number
): StrokePatch => {
  const nextColor = convertUserColorToDefault(
    color,
    sourceStroke.fill.defaultColorFormat,
    sourceStroke.fill.color
  )

  const patch = createColorPatch(sourceStroke, nextColor)
  if (!isEqual(sourceStroke.fill.opacity, opacity)) {
    const nextFill = patch.fill ?? sourceStroke.fill
    return createFillPatch(
      {
        ...sourceStroke,
        fill: nextFill
      },
      { opacity }
    )
  }

  return patch
}

interface UseStrokeInteractionsArgs {
  stroke: StrokeAttrs | null
  strokeId: string
  ownerElementId: string | null
}

export const useStrokeInteractions = ({
  stroke,
  strokeId,
  ownerElementId
}: UseStrokeInteractionsArgs) => {
  const colorPickerTransactionRef = useRef(false)
  const pickerStrokeRef = useRef<StrokeAttrs | null>(stroke)
  const pickerStartStrokeRef = useRef<StrokeAttrs | null>(null)
  const pickerLatestStrokeRef = useRef<StrokeAttrs | null>(null)

  useEffect(() => {
    pickerStrokeRef.current = stroke
  }, [stroke])

  const displayColor = useMemo(() => {
    if (!stroke) {
      return ''
    }

    return convertToHexUpper(stroke.fill.color)
  }, [stroke])

  const commitStrokePatch = (
    patch: StrokePatch,
    options?: EVENT_OPTIONS,
    sourceStroke?: StrokeAttrs | null
  ) => {
    const currentStroke = sourceStroke ?? stroke
    if (!currentStroke || !ownerElementId || !hasStrokePatch(patch)) {
      return
    }

    strokeApis.updateStrokeFields(
      ownerElementId,
      strokeId,
      currentStroke,
      patch,
      options
    )
  }

  const commitStrokeInteractionPatch = (
    patch: StrokePatch,
    options?: EVENT_OPTIONS,
    sourceStroke?: StrokeAttrs | null
  ) => {
    commitStrokePatch(patch, options, sourceStroke)
  }

  const commitStrokeStyleIntent = (patch: StrokeStyleIntentPatch) => {
    const intent = createStrokeStyleIntent({
      stroke,
      strokeId,
      ownerElementId,
      patch
    })
    if (!intent) {
      return false
    }

    commitStrokeInteractionPatch(intent.patch)
    return true
  }

  const writePickerStroke = (
    color: string,
    opacity: number,
    options?: EVENT_OPTIONS
  ) => {
    const sourceStroke = pickerStrokeRef.current
    if (!sourceStroke) {
      return null
    }

    const patch = createPickerPatch(sourceStroke, color, opacity)
    const nextStroke = applyStrokePatch(sourceStroke, patch)
    pickerLatestStrokeRef.current = nextStroke
    commitStrokePatch(patch, options, sourceStroke)
    return nextStroke
  }

  const startStrokeInteractionTransaction = () => {
    const currentStroke = pickerStrokeRef.current
    if (colorPickerTransactionRef.current || !currentStroke) {
      return
    }

    colorPickerTransactionRef.current = true
    transactionApis.startTransaction()
  }

  const endStrokeInteractionTransaction = () => {
    if (!colorPickerTransactionRef.current) {
      return
    }

    colorPickerTransactionRef.current = false
    transactionApis.endTransaction()
  }

  const handleVisibleChange = (nextVisible: boolean) => {
    if (!stroke || isEqual(stroke.fill.visible, nextVisible)) {
      return
    }

    commitStrokeInteractionPatch(
      createFillPatch(stroke, { visible: nextVisible })
    )
  }

  const handleOpacityChange = (value: string): boolean => {
    const parsed = Number.parseFloat(value)
    if (!Number.isFinite(parsed)) {
      return false
    }

    const nextOpacity = Math.max(0, Math.min(100, parsed)) / 100
    if (!stroke || isEqual(stroke.fill.opacity, nextOpacity)) {
      return false
    }

    commitStrokeInteractionPatch(
      createFillPatch(stroke, { opacity: nextOpacity })
    )
    return true
  }

  const handleFormatChange = (nextFormat: FillColorFormat) => {
    if (!stroke || isEqual(stroke.fill.colorFormat, nextFormat)) {
      return
    }

    if (!ALLOWED_COLOR_FORMATS.includes(nextFormat)) {
      return
    }

    commitStrokeInteractionPatch(
      createFillPatch(stroke, {
        colorFormat: nextFormat
      })
    )
  }

  const handleColorValueChange = (value: string): boolean => {
    if (!stroke) {
      return false
    }

    const nextColor = convertUserColorToDefault(
      value,
      stroke.fill.defaultColorFormat,
      stroke.fill.color
    )

    const patch = createColorPatch(stroke, nextColor)
    if (!hasStrokePatch(patch)) {
      return false
    }

    commitStrokeInteractionPatch(patch)
    return true
  }

  const handleColorPickerChange = (next: {
    color: string
    opacity: number
  }) => {
    if (colorPickerTransactionRef.current) {
      writePickerStroke(next.color, next.opacity, { undoable: false })
      return
    }

    writePickerStroke(next.color, next.opacity)
  }

  const handleColorPickerChangeStart = () => {
    const currentStroke = pickerStrokeRef.current
    if (!currentStroke) {
      return
    }

    pickerStartStrokeRef.current = currentStroke
    pickerLatestStrokeRef.current = currentStroke
    startStrokeInteractionTransaction()
  }

  const handleColorPickerChangeEnd = (next: {
    color: string
    opacity: number
  }) => {
    if (!colorPickerTransactionRef.current) {
      return
    }

    const startStroke = pickerStartStrokeRef.current
    const finalPatch = startStroke
      ? createPickerPatch(startStroke, next.color, next.opacity)
      : null
    const finalStroke =
      startStroke && finalPatch
        ? applyStrokePatch(startStroke, finalPatch)
        : pickerLatestStrokeRef.current

    if (startStroke && finalStroke && !isEqual(startStroke, finalStroke)) {
      commitStrokePatch(
        getChangedStrokePatch(finalStroke, startStroke),
        { undoable: false },
        finalStroke
      )
      commitStrokePatch(finalPatch ?? {}, undefined, startStroke)
    }

    pickerStartStrokeRef.current = null
    pickerLatestStrokeRef.current = null
    endStrokeInteractionTransaction()
  }

  const handleStyleChange = (nextStyle: StrokeAttrs['style']) => {
    commitStrokeStyleIntent({ style: nextStyle })
  }

  const handlePositionChange = (nextPosition: StrokeAttrs['position']) => {
    commitStrokeStyleIntent({ position: nextPosition })
  }

  const handleWidthChange = (value: string): boolean => {
    const parsed = parseFiniteInputNumber(value)
    if (parsed === null) {
      return false
    }

    const nextWidth = Math.max(0, parsed)
    return commitStrokeStyleIntent({ width: nextWidth })
  }

  const handleDashLengthChange = (value: string): boolean => {
    if (!stroke) {
      return false
    }

    const parsed = parseFiniteInputNumber(value)
    if (parsed === null || parsed <= 0) {
      return false
    }

    return commitStrokeStyleIntent({ dash: parsed })
  }

  const handleGapLengthChange = (value: string): boolean => {
    if (!stroke) {
      return false
    }

    const parsed = parseFiniteInputNumber(value)
    if (parsed === null || parsed <= 0) {
      return false
    }

    return commitStrokeStyleIntent({ gap: parsed })
  }

  const handleJoinTypeChange = (nextJoin: StrokeAttrs['joinType']) => {
    commitStrokeStyleIntent({ joinType: nextJoin })
  }

  const handleCapTypeChange = (nextCap: StrokeAttrs['capType']) => {
    commitStrokeStyleIntent({ capType: nextCap })
  }

  const handleMiterAngleChange = (value: string): boolean => {
    const parsed = parseFiniteInputNumber(value)
    if (parsed === null) {
      return false
    }

    const nextAngle = Math.max(0, Math.min(180, parsed))
    return commitStrokeStyleIntent({ miterAngle: nextAngle })
  }

  return {
    displayColor,
    handleVisibleChange,
    handleOpacityChange,
    handleFormatChange,
    handleColorValueChange,
    handleColorPickerChange,
    handleColorPickerChangeStart,
    handleColorPickerChangeEnd,
    handleStyleChange,
    handlePositionChange,
    handleWidthChange,
    handleDashLengthChange,
    handleGapLengthChange,
    handleJoinTypeChange,
    handleCapTypeChange,
    handleMiterAngleChange
  }
}
