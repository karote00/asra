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
  formatHexValue,
  hsvaToRgba,
  parseColor,
  rgbaToHex,
  rgbaToHsva,
  type HSVAColor
} from './color-utils'

interface ColorPickerChange {
  color: string
  opacity: number
}

interface ColorPickerProps {
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
  hideDefaultPanel?: boolean
  children?: React.ReactNode
  swatchStyle?: CSSProperties
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

const CHECKERBOARD_BACKGROUND = {
  backgroundImage:
    'linear-gradient(45deg, #5C5C5C 25%, transparent 25%), linear-gradient(-45deg, #5C5C5C 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #5C5C5C 75%), linear-gradient(-45deg, transparent 75%, #5C5C5C 75%)',
  backgroundSize: '8px 8px',
  backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0'
} as const

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
  hideDefaultPanel = false,
  children,
  swatchStyle,
  'data-testid': dataTestId
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false)
  const [draftHex, setDraftHex] = useState('')
  const [draftOpacity, setDraftOpacity] = useState('')
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

    const next = createHsvaColor(color, opacity)
    setHsva(next)
    hsvaRef.current = next
    setDraftHex(rgbaToHex({ ...hsvaToRgba(next), a: 1 }).replace('#', ''))
    setDraftOpacity(String(Math.round(next.a * 100)))
  }, [color, opacity])

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
    const nextColor = rgbaToHex({ ...hsvaToRgba(next), a: 1 })
    setHsva(next)
    hsvaRef.current = next
    setDraftHex(nextColor.replace('#', ''))
    setDraftOpacity(String(Math.round(next.a * 100)))
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

  const commitHex = () => {
    const parsed = parseColor(`#${formatHexValue(draftHex)}`)
    if (!parsed) {
      setDraftHex(
        rgbaToHex({ ...hsvaToRgba(hsvaRef.current), a: 1 }).replace('#', '')
      )
      return
    }

    const next = {
      ...rgbaToHsva(parsed),
      a: hsvaRef.current.a
    }
    emitChange(next)
  }

  const commitOpacity = () => {
    const parsed = Number.parseFloat(draftOpacity)
    if (!Number.isFinite(parsed)) {
      setDraftOpacity(String(Math.round(hsvaRef.current.a * 100)))
      return
    }

    const next = {
      ...hsvaRef.current,
      a: clampUnit(parsed / 100)
    }
    emitChange(next)
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
        className="group relative h-7 w-10 overflow-hidden rounded border border-[#4A4A4A] bg-[#2B2B2B] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors hover:border-[#6A6A6A] disabled:cursor-not-allowed disabled:opacity-50"
        data-testid={dataTestId ? `${dataTestId}-trigger` : undefined}
        aria-label="Toggle color picker"
      >
        <span className="absolute inset-0" style={CHECKERBOARD_BACKGROUND} />
        <span
          className="absolute inset-[2px] rounded-[3px]"
          style={{
            backgroundColor: swatchColor,
            ...swatchStyle
          }}
        />
      </button>

      {isOpen && portalRoot
        ? createPortal(
            <div
              ref={panelRef}
              className="fixed z-50 w-[256px] overflow-y-auto rounded-xl border border-[#3E3E3E] bg-[#252627] p-3 text-white shadow-[0_20px_50px_rgba(0,0,0,0.45)]"
              style={{
                left: panelPosition?.left ?? -9999,
                top: panelPosition?.top ?? -9999,
                maxHeight: panelPosition?.maxHeight,
                visibility: panelPosition ? 'visible' : 'hidden'
              }}
              data-testid={dataTestId ? `${dataTestId}-panel` : undefined}
            >
              {header ? <div className="mb-3">{header}</div> : null}

              {!hideDefaultPanel ? (
                <>
                  <div>
                    <div
                      ref={saturationRef}
                      className="relative h-40 w-full cursor-crosshair rounded-lg border border-[#4B4B4B]"
                      style={{
                        backgroundColor: hueColor,
                        backgroundImage:
                          'linear-gradient(to top, #000, transparent), linear-gradient(to right, #FFF, transparent)',
                        overflow: 'clip'
                      }}
                      onPointerDown={(event) => beginDrag('saturation', event)}
                      data-testid={
                        dataTestId ? `${dataTestId}-saturation` : undefined
                      }
                    >
                      <div
                        className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.45)]"
                        style={{
                          left: `${hsva.s * 100}%`,
                          top: `${(1 - hsva.v) * 100}%`
                        }}
                      />
                    </div>

                    <div className="mt-3 space-y-2">
                      <div
                        ref={hueRef}
                        className="relative h-4 w-full cursor-ew-resize rounded-full border border-[#4B4B4B]"
                        style={{
                          background:
                            'linear-gradient(90deg, #FF3B30 0%, #FFC700 17%, #34C759 34%, #00C7BE 51%, #0A84FF 68%, #AF52DE 85%, #FF3B30 100%)'
                        }}
                        onPointerDown={(event) => beginDrag('hue', event)}
                        data-testid={
                          dataTestId ? `${dataTestId}-hue` : undefined
                        }
                      >
                        <div
                          className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-transparent shadow-[0_0_0_1px_rgba(0,0,0,0.55)]"
                          style={{
                            left: `calc(${SLIDER_THUMB_RADIUS}px + ${hsva.h / 360} * (100% - ${SLIDER_THUMB_SIZE}px))`
                          }}
                        />
                      </div>

                      <div
                        ref={alphaRef}
                        className="relative h-4 w-full cursor-ew-resize rounded-full border border-[#4B4B4B]"
                        style={CHECKERBOARD_BACKGROUND}
                        onPointerDown={(event) => beginDrag('alpha', event)}
                        data-testid={
                          dataTestId ? `${dataTestId}-alpha` : undefined
                        }
                      >
                        <div
                          className="absolute inset-0"
                          style={{
                            background: `linear-gradient(90deg, rgba(${Math.round(
                              currentRgba.r
                            )}, ${Math.round(currentRgba.g)}, ${Math.round(
                              currentRgba.b
                            )}, 0) 0%, rgba(${Math.round(
                              currentRgba.r
                            )}, ${Math.round(currentRgba.g)}, ${Math.round(
                              currentRgba.b
                            )}, 1) 100%)`
                          }}
                        />
                        <div
                          className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-transparent shadow-[0_0_0_1px_rgba(0,0,0,0.55)]"
                          style={{
                            left: `calc(${SLIDER_THUMB_RADIUS}px + ${hsva.a} * (100% - ${SLIDER_THUMB_SIZE}px))`
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-[1fr_76px] gap-2">
                    <label className="flex items-center rounded-md border border-[#434445] bg-[#1D1E1F] px-2 text-[11px] text-[#AEB3B7]">
                      <span className="mr-2 text-[10px] uppercase tracking-[0.08em]">
                        Hex
                      </span>
                      <input
                        type="text"
                        value={draftHex}
                        onChange={(event) =>
                          setDraftHex(formatHexValue(event.target.value))
                        }
                        onBlur={commitHex}
                        onKeyDown={(event) => {
                          event.stopPropagation()
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            commitHex()
                            ;(event.target as HTMLInputElement).blur()
                          }
                        }}
                        className="w-full bg-transparent text-right text-[12px] text-white outline-none"
                        data-testid={
                          dataTestId ? `${dataTestId}-hex` : undefined
                        }
                      />
                    </label>

                    <label className="flex items-center rounded-md border border-[#434445] bg-[#1D1E1F] px-2 text-[11px] text-[#AEB3B7]">
                      <span className="mr-2 text-[10px] uppercase tracking-[0.08em]">
                        Op
                      </span>
                      <input
                        type="text"
                        value={draftOpacity}
                        onChange={(event) =>
                          setDraftOpacity(
                            event.target.value.replace(/[^0-9.]/g, '')
                          )
                        }
                        onBlur={commitOpacity}
                        onKeyDown={(event) => {
                          event.stopPropagation()
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            commitOpacity()
                            ;(event.target as HTMLInputElement).blur()
                          }
                        }}
                        className="w-full bg-transparent text-right text-[12px] text-white outline-none"
                        data-testid={
                          dataTestId ? `${dataTestId}-opacity` : undefined
                        }
                      />
                      <span className="ml-1 text-[11px] text-[#8A8E92]">%</span>
                    </label>
                  </div>
                </>
              ) : null}

              {children ? (
                <div className={hideDefaultPanel ? '' : 'mt-3'}>{children}</div>
              ) : null}
            </div>,
            portalRoot
          )
        : null}
    </div>
  )
}

export type { ColorPickerChange, ColorPickerProps }
export default ColorPicker
