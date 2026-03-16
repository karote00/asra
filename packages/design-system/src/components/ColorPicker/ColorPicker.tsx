import React, {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties
} from 'react'
import { createPortal } from 'react-dom'
import {
  clampUnit,
  createHsvaColor,
  hsvaToRgba,
  parseColor,
  rgbaToHex,
  rgbaToHsva,
  hsvaToHsla,
  formatColor,
  type HSVAColor
} from './color-utils'
import { ColorPickerSaturation } from './ColorPickerSaturation'
import { ColorPickerSliders } from './ColorPickerSliders'
import { ColorPickerInputGroup } from './ColorPickerInputGroup'

export interface ColorFormatDefinition {
  id: string
  label: string
  toValues: (hsva: HSVAColor) => string[]
  fromValues: (values: string[], currentHsva: HSVAColor) => HSVAColor | null
  formatInput?: (value: string, index: number) => string
}

export interface ColorPickerChange {
  color: string
  opacity: number
}

export interface ColorPickerProps {
  color: string
  opacity?: number
  disabled?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  shouldIgnoreOutsidePointerDown?: (target: Node) => boolean
  onChange: (next: ColorPickerChange) => void
  onChangeStart?: () => void
  onChangeEnd?: (next: ColorPickerChange) => void
  header?: React.ReactNode
  footer?: React.ReactNode
  colorFormat?: string
  hideDefaultPanel?: boolean
  children?: React.ReactNode
  swatchStyle?: CSSProperties
  triggerClassName?: string
  triggerStyle?: CSSProperties
  onFormatChange?: (format: string) => void
  formatOptions?: readonly string[]
  formatDefinitions?: ColorFormatDefinition[]
  showAlpha?: boolean
  'data-testid'?: string
}

type DragTarget = 'saturation' | 'hue' | 'alpha'

interface PanelPosition {
  left: number
  top: number
  maxHeight: number
}

interface EmittedValue {
  color: string
  opacity: number
}

const PANEL_WIDTH = 256
const VIEWPORT_PADDING = 8
const VIEWPORT_VERTICAL_PADDING = 16
const SLIDER_THUMB_SIZE = 16
const SLIDER_THUMB_RADIUS = SLIDER_THUMB_SIZE / 2
const POPUP_ROOT_ID = 'asyra-color-picker-popup-root'

const normalizeColorToken = (value: string) => value.trim().toLowerCase()

const toPointerPosition = (event: PointerEvent | React.PointerEvent) => ({
  x: event.clientX,
  y: event.clientY
})

const ensurePopupRoot = () => {
  if (typeof document === 'undefined') {
    return null
  }

  const existing = document.getElementById(POPUP_ROOT_ID)
  if (existing) {
    return existing
  }

  const root = document.createElement('div')
  root.id = POPUP_ROOT_ID
  root.style.position = 'relative'
  root.style.zIndex = '999'
  document.body.appendChild(root)
  return root
}

const ColorPicker: React.FC<ColorPickerProps> = ({
  color,
  opacity = 1,
  disabled = false,
  open,
  onOpenChange,
  shouldIgnoreOutsidePointerDown,
  onChange,
  onChangeStart,
  onChangeEnd,
  header,
  footer,
  hideDefaultPanel = false,
  children,
  swatchStyle,
  triggerClassName,
  triggerStyle,
  colorFormat = 'hex',
  onFormatChange,
  formatOptions = [],
  formatDefinitions = [],
  showAlpha = true,
  'data-testid': dataTestId
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false)
  const [draftValues, setDraftValues] = useState<string[]>([])
  const [hsva, setHsva] = useState(() => createHsvaColor(color, opacity))
  const [panelPosition, setPanelPosition] = useState<PanelPosition | null>(null)
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null)
  const hsvaRef = useRef(hsva)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const saturationRef = useRef<HTMLDivElement | null>(null)
  const hueRef = useRef<HTMLDivElement | null>(null)
  const alphaRef = useRef<HTMLDivElement | null>(null)
  const dragTargetRef = useRef<DragTarget | null>(null)
  const pointerCleanupRef = useRef<(() => void) | null>(null)
  const onChangeRef = useRef(onChange)
  const onChangeStartRef = useRef(onChangeStart)
  const onChangeEndRef = useRef(onChangeEnd)
  const onOpenChangeRef = useRef(onOpenChange)
  const shouldIgnoreOutsidePointerDownRef = useRef(
    shouldIgnoreOutsidePointerDown
  )
  const lastEmittedRef = useRef<EmittedValue | null>(null)
  const isOpen = open ?? internalIsOpen

  const getCurrentEmittedValue = (): EmittedValue =>
    lastEmittedRef.current ?? {
      color: rgbaToHex({ ...hsvaToRgba(hsvaRef.current), a: 1 }),
      opacity: hsvaRef.current.a
    }

  useEffect(() => {
    const lastEmitted = lastEmittedRef.current
    if (
      lastEmitted &&
      normalizeColorToken(lastEmitted.color) === normalizeColorToken(color) &&
      Math.abs(lastEmitted.opacity - opacity) < 0.0001
    ) {
      return
    }

    lastEmittedRef.current = null
    const next = createHsvaColor(color, opacity)
    setHsva(next)
    hsvaRef.current = next

    const currentDef = formatDefinitions.find((d) => d.id === colorFormat)
    if (!currentDef) {
      setDraftValues([])
      return
    }
    const baseValues = currentDef.toValues(next)
    if (showAlpha && colorFormat !== 'css') {
      setDraftValues([...baseValues, String(Math.round(next.a * 100))])
    } else {
      setDraftValues(baseValues)
    }
  }, [color, opacity, colorFormat, showAlpha, formatDefinitions])

  useEffect(() => {
    onChangeRef.current = onChange
    onChangeStartRef.current = onChangeStart
    onChangeEndRef.current = onChangeEnd
    onOpenChangeRef.current = onOpenChange
    shouldIgnoreOutsidePointerDownRef.current = shouldIgnoreOutsidePointerDown
  }, [
    onChange,
    onChangeStart,
    onChangeEnd,
    onOpenChange,
    shouldIgnoreOutsidePointerDown
  ])

  useEffect(() => {
    setPortalRoot(ensurePopupRoot())
  }, [])

  const setPickerOpen = (nextOpen: boolean) => {
    if (open === undefined) {
      setInternalIsOpen(nextOpen)
    }

    onOpenChangeRef.current?.(nextOpen)
  }

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handlePointerDownOutside = (event: PointerEvent) => {
      const target = event.target as Node
      if (shouldIgnoreOutsidePointerDownRef.current?.(target)) {
        return
      }

      if (
        !rootRef.current?.contains(target) &&
        !panelRef.current?.contains(target)
      ) {
        setPickerOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDownOutside)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDownOutside)
    }
  }, [isOpen])

  useLayoutEffect(() => {
    if (!isOpen) {
      setPanelPosition(null)
      return
    }

    const updatePanelPosition = () => {
      const triggerRect = triggerRef.current?.getBoundingClientRect()
      const panelRect = panelRef.current?.getBoundingClientRect()
      if (!triggerRect || !panelRect) {
        return
      }

      const viewportHeight = window.innerHeight
      const panelWidth = panelRect.width || PANEL_WIDTH
      const panelHeight = panelRect.height
      const rootPanelRect = rootRef.current
        ?.closest('[data-testid$="-panel"], [data-testid="properties-panel"]')
        ?.getBoundingClientRect()

      const anchorRect = rootPanelRect ?? triggerRect

      let left = anchorRect.left - panelWidth
      const top = Math.min(
        Math.max(VIEWPORT_VERTICAL_PADDING, triggerRect.top),
        viewportHeight - panelHeight - VIEWPORT_VERTICAL_PADDING
      )

      left = Math.max(VIEWPORT_PADDING, left)

      setPanelPosition({
        left,
        top,
        maxHeight: viewportHeight - VIEWPORT_VERTICAL_PADDING * 2
      })
    }

    updatePanelPosition()
    window.addEventListener('resize', updatePanelPosition)
    window.addEventListener('scroll', updatePanelPosition, true)

    return () => {
      window.removeEventListener('resize', updatePanelPosition)
      window.removeEventListener('scroll', updatePanelPosition, true)
    }
  }, [isOpen])

  useEffect(() => {
    return () => {
      pointerCleanupRef.current?.()
      if (dragTargetRef.current) {
        dragTargetRef.current = null
        onChangeEndRef.current?.(getCurrentEmittedValue())
      }
    }
  }, [])

  const emitChange = (next: HSVAColor) => {
    const rgba = hsvaToRgba(next)
    const hsla = hsvaToHsla(next)
    const nextColor = formatColor(rgba, hsla, colorFormat)
    setHsva(next)
    hsvaRef.current = next

    const currentDef = formatDefinitions.find((d) => d.id === colorFormat)
    if (currentDef) {
      const baseValues = currentDef.toValues(next)
      if (showAlpha && colorFormat !== 'css') {
        setDraftValues([...baseValues, String(Math.round(next.a * 100))])
      } else {
        setDraftValues(baseValues)
      }
    }

    lastEmittedRef.current = {
      color: nextColor,
      opacity: next.a
    }
    onChangeRef.current({
      color: nextColor,
      opacity: next.a
    })
  }

  const updateFromSaturation = (position: { x: number; y: number }) => {
    const rect = saturationRef.current?.getBoundingClientRect()
    if (!rect) {
      return
    }

    const next = {
      ...hsvaRef.current,
      s: clampUnit((position.x - rect.left) / rect.width),
      v: clampUnit(1 - (position.y - rect.top) / rect.height)
    }
    emitChange(next)
  }

  const updateFromHue = (position: { x: number }) => {
    const rect = hueRef.current?.getBoundingClientRect()
    if (!rect) {
      return
    }

    const usableWidth = Math.max(1, rect.width - SLIDER_THUMB_SIZE)
    const relativeX = clampUnit(
      (position.x - rect.left - SLIDER_THUMB_RADIUS) / usableWidth
    )

    const next = {
      ...hsvaRef.current,
      h: relativeX * 360
    }
    emitChange(next)
  }

  const updateFromAlpha = (position: { x: number }) => {
    const rect = alphaRef.current?.getBoundingClientRect()
    if (!rect) {
      return
    }

    const usableWidth = Math.max(1, rect.width - SLIDER_THUMB_SIZE)
    const relativeX = clampUnit(
      (position.x - rect.left - SLIDER_THUMB_RADIUS) / usableWidth
    )

    const next = {
      ...hsvaRef.current,
      a: relativeX
    }
    emitChange(next)
  }

  const updateDragTarget = (
    target: DragTarget,
    position: { x: number; y: number }
  ) => {
    if (target === 'saturation') {
      updateFromSaturation(position)
      return
    }

    if (target === 'hue') {
      updateFromHue(position)
      return
    }

    updateFromAlpha(position)
  }

  const endDrag = () => {
    pointerCleanupRef.current?.()
    pointerCleanupRef.current = null
    dragTargetRef.current = null
    onChangeEndRef.current?.(getCurrentEmittedValue())
  }

  const beginDrag = (
    target: DragTarget,
    event: React.PointerEvent<HTMLDivElement>
  ) => {
    event.preventDefault()
    event.stopPropagation()

    pointerCleanupRef.current?.()
    dragTargetRef.current = target
    onChangeStartRef.current?.()
    updateDragTarget(target, toPointerPosition(event))

    const handlePointerMove = (pointerEvent: PointerEvent) => {
      const currentTarget = dragTargetRef.current
      if (!currentTarget) {
        return
      }

      updateDragTarget(currentTarget, toPointerPosition(pointerEvent))
    }

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
      endDrag()
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)

    pointerCleanupRef.current = () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }

  const handleEyeDropper = async () => {
    if (!('EyeDropper' in window)) {
      return
    }

    try {
      // @ts-expect-error EyeDropper is not yet in standard TS libs
      const eyeDropper = new window.EyeDropper()
      const result = await eyeDropper.open()
      const parsed = parseColor(result.sRGBHex)
      if (parsed) {
        emitChange({
          ...rgbaToHsva(parsed),
          a: hsvaRef.current.a
        })
      }
    } catch (e) {
      // Ignore errors (user cancel or failure)
    }
  }

  const handleInputChange = (value: string, index: number) => {
    const currentDef = formatDefinitions.find((d) => d.id === colorFormat)
    if (!currentDef) return

    const nextDrafts = [...draftValues]

    if (
      showAlpha &&
      colorFormat !== 'css' &&
      index === draftValues.length - 1
    ) {
      nextDrafts[index] = value.replace(/[^0-9.]/g, '')
    } else if (currentDef.formatInput) {
      nextDrafts[index] = currentDef.formatInput(value, index)
    } else {
      nextDrafts[index] = value
    }

    setDraftValues(nextDrafts)
  }

  const handleInputBlur = (index: number) => {
    const currentDef = formatDefinitions.find((d) => d.id === colorFormat)
    if (!currentDef) return

    if (
      showAlpha &&
      colorFormat !== 'css' &&
      index === draftValues.length - 1
    ) {
      const parsed = Number.parseFloat(draftValues[index])
      if (Number.isFinite(parsed)) {
        emitChange({ ...hsvaRef.current, a: clampUnit(parsed / 100) })
      } else {
        syncDraftsFromHsva(hsvaRef.current)
      }
      return
    }

    const colorPart =
      showAlpha && colorFormat !== 'css'
        ? draftValues.slice(0, -1)
        : draftValues

    const nextHsva = currentDef.fromValues(colorPart, hsvaRef.current)
    if (nextHsva) {
      emitChange(nextHsva)
    } else {
      syncDraftsFromHsva(hsvaRef.current)
    }
  }

  const syncDraftsFromHsva = (current: HSVAColor) => {
    const currentDef = formatDefinitions.find((d) => d.id === colorFormat)
    if (!currentDef) return

    const base = currentDef.toValues(current)
    if (showAlpha && colorFormat !== 'css') {
      setDraftValues([...base, String(Math.round(current.a * 100))])
    } else {
      setDraftValues(base)
    }
  }

  const currentRgba = hsvaToRgba(hsva)
  const hueColor = rgbaToHex({
    ...hsvaToRgba({
      ...hsva,
      s: 1,
      v: 1,
      a: 1
    }),
    a: 1
  })

  const swatchColor = `rgba(${Math.round(currentRgba.r)}, ${Math.round(
    currentRgba.g
  )}, ${Math.round(currentRgba.b)}, ${hsva.a})`

  return (
    <div
      ref={rootRef}
      className="relative inline-flex"
      data-testid={dataTestId}
    >
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onPointerDown={(event) => {
          event.preventDefault()
          if (disabled) {
            return
          }

          setPickerOpen(!isOpen)
        }}
        className={
          triggerClassName ??
          'group relative flex h-7 w-10 items-center justify-center overflow-hidden rounded bg-[#2B2B2B] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] disabled:cursor-not-allowed disabled:opacity-50'
        }
        style={triggerStyle}
        data-testid={dataTestId ? `${dataTestId}-trigger` : undefined}
        aria-label="Toggle color picker"
      >
        <div
          className="rounded-[3px]"
          style={{
            backgroundColor: swatchColor,
            flexShrink: 0,
            ...swatchStyle
          }}
        />
      </button>

      {isOpen && portalRoot
        ? createPortal(
            <div
              ref={panelRef}
              className="fixed z-50 w-[256px] overflow-y-auto rounded-xl border border-[#3E3E3E] bg-[#252627] text-white shadow-[0_20px_50px_rgba(0,0,0,0.45)]"
              style={{
                left: panelPosition?.left ?? -9999,
                top: panelPosition?.top ?? -9999,
                maxHeight: panelPosition?.maxHeight,
                visibility: panelPosition ? 'visible' : 'hidden'
              }}
              data-testid={dataTestId ? `${dataTestId}-panel` : undefined}
            >
              {header ? <div className="px-3 pt-3 mb-3">{header}</div> : null}

              {!hideDefaultPanel ? (
                <>
                  <div className={`${header ? '' : 'pt-3'} pb-3`}>
                    <ColorPickerSaturation
                      hsva={hsva}
                      hueColor={hueColor}
                      onPointerDown={(event) => beginDrag('saturation', event)}
                      saturationRef={saturationRef}
                      data-testid={
                        dataTestId ? `${dataTestId}-saturation` : undefined
                      }
                    />

                    <ColorPickerSliders
                      hsva={hsva}
                      currentRgba={currentRgba}
                      hueRef={hueRef}
                      alphaRef={alphaRef}
                      onEyeDropper={handleEyeDropper}
                      onSliderPointerDown={(type, event) =>
                        beginDrag(type, event)
                      }
                      data-testid={dataTestId}
                    />

                    <ColorPickerInputGroup
                      colorFormat={colorFormat}
                      formatOptions={formatOptions as string[]}
                      onFormatChange={onFormatChange}
                      values={draftValues}
                      onChange={handleInputChange}
                      onBlur={handleInputBlur}
                      showAlpha={showAlpha && colorFormat !== 'css'}
                      data-testid={dataTestId}
                    />
                  </div>
                </>
              ) : null}

              {children ? (
                <div className={hideDefaultPanel ? '' : 'mt-2'}>{children}</div>
              ) : null}

              {footer ? (
                <div
                  className={`px-3 pb-3 ${hideDefaultPanel && !children ? 'pt-3' : 'mt-2'}`}
                >
                  {footer}
                </div>
              ) : null}
            </div>,
            portalRoot
          )
        : null}
    </div>
  )
}

export default ColorPicker
