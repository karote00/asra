import { Input, PropertyControl } from '@asyra/design-system'
import {
  StrokeCapTypes,
  StrokeJoinTypes,
  StrokePositions,
  StrokeStyles,
  type StrokeAttrs
} from '@asyra/utils'
import type { CSSProperties } from 'react'
import { useStroke } from '../../providers'
import { formatInputNumber } from '../number-input'
import { getStrokeDashGap } from './dash-gap'
import StrokeColorRow from './stroke-color-row'
import { useStrokeInteractions } from './use-stroke-interactions'

interface StrokeItemProps {
  index: number
  strokeId: string
  ownerElementId: string | null
  onRemove: () => void
}

const EyeOpenIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 14 14"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.3"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M1.5 7s2-4 5.5-4 5.5 4 5.5 4-2 4-5.5 4S1.5 7 1.5 7z" />
    <circle cx="7" cy="7" r="1.75" />
  </svg>
)

const EyeClosedIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 14 14"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.3"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2 2l10 10" />
    <path d="M5.6 5.6a1.75 1.75 0 0 0 2.8 2.8" />
    <path d="M3.5 4.4C2.3 5.4 1.5 7 1.5 7s2 4 5.5 4c.8 0 1.6-.2 2.2-.5" />
    <path d="M9.8 8.9c1-1 1.7-2.4 1.7-2.4S9.5 3 7 3c-.4 0-.8 0-1.2.2" />
  </svg>
)

const MinusIcon = () => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 10 10"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
  >
    <path d="M1 5h8" />
  </svg>
)

const STYLE_OPTIONS = [
  { value: StrokeStyles.SOLID, label: 'Solid' },
  { value: StrokeStyles.DASHED, label: 'Dashed' }
] as const

const POSITION_OPTIONS = [
  { value: StrokePositions.CENTER, label: 'Center' },
  { value: StrokePositions.INSIDE, label: 'Inside' },
  { value: StrokePositions.OUTSIDE, label: 'Outside' }
] as const

const JOIN_OPTIONS = [
  { value: StrokeJoinTypes.MITER, label: 'Miter' },
  { value: StrokeJoinTypes.BEVEL, label: 'Bevel' },
  { value: StrokeJoinTypes.ROUND, label: 'Round' }
] as const

const CAP_OPTIONS = [
  { value: StrokeCapTypes.BUTT, label: 'Butt' },
  { value: StrokeCapTypes.SQUARE, label: 'Square' },
  { value: StrokeCapTypes.ROUND, label: 'Round' }
] as const

const strokeSelectWrapperClassName =
  'h-6 flex items-center rounded-[3px] bg-panel-surface-hover border border-transparent hover:border-[#5c5c5c] focus-within:border-border-focus transition-all overflow-hidden text-white'

const strokeSelectClassName =
  '!pr-4 !pl-1 w-full bg-transparent text-[11px] text-white outline-none appearance-none cursor-pointer h-full'

const strokeSelectStyle = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg width='6' height='4' viewBox='0 0 6 4' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1.5 1L3 2.5L4.5 1' stroke='white' stroke-width='1.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
  backgroundPosition: 'right 4px center',
  backgroundRepeat: 'no-repeat'
} satisfies CSSProperties

const StrokeItem = ({
  index,
  strokeId,
  ownerElementId,
  onRemove
}: StrokeItemProps) => {
  const stroke = useStroke(strokeId)
  const {
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
  } = useStrokeInteractions({
    stroke: stroke as StrokeAttrs | null,
    strokeId,
    ownerElementId
  })

  if (!stroke) {
    return null
  }

  const strokeAttrs = {
    ...stroke,
    id: strokeId
  } satisfies StrokeAttrs
  const dashGap = getStrokeDashGap(stroke.dashPattern)

  return (
    <div className="grid grid-cols-1 gap-1 py-1">
      <div
        className="grid grid-cols-[1fr_24px_24px] items-center gap-2 pl-4 pr-2 h-8 min-h-8"
        data-testid={`prop-stroke-${index}`}
      >
        <StrokeColorRow
          index={index}
          stroke={strokeAttrs}
          displayColor={displayColor}
          colorFormat={stroke.fill.colorFormat}
          onColorValueChange={handleColorValueChange}
          onColorPickerChange={handleColorPickerChange}
          onColorPickerChangeStart={handleColorPickerChangeStart}
          onColorPickerChangeEnd={handleColorPickerChangeEnd}
          onFormatChange={handleFormatChange}
          opacity={stroke.fill.opacity}
          onOpacityChange={handleOpacityChange}
          opacityTestId={`prop-stroke-opacity-${index}`}
        />

        <button
          type="button"
          onClick={() => handleVisibleChange(!stroke.fill.visible)}
          className="flex items-center justify-center h-6 w-6 rounded hover:bg-panel-surface-hover text-white/60 hover:text-white transition-colors"
          data-testid={`prop-stroke-visible-${index}`}
          title={stroke.fill.visible ? 'Hide stroke' : 'Show stroke'}
          style={{ width: '24px', height: '24px' }}
        >
          {stroke.fill.visible ? <EyeOpenIcon /> : <EyeClosedIcon />}
        </button>

        <button
          type="button"
          onClick={onRemove}
          className="flex items-center justify-center h-6 w-6 rounded hover:bg-panel-surface-hover text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
          data-testid={`prop-stroke-remove-${index}`}
          title="Remove stroke"
          aria-label="Remove stroke"
        >
          <MinusIcon />
        </button>
      </div>

      <div className="grid grid-cols-[72px_minmax(0,1fr)_minmax(0,1fr)_60px] items-center gap-2 pl-4 pr-2 h-8 min-h-8">
        <div className={`${strokeSelectWrapperClassName} w-[72px]`}>
          <select
            value={stroke.position}
            onChange={(event) =>
              handlePositionChange(
                event.target.value as StrokeAttrs['position']
              )
            }
            className={strokeSelectClassName}
            style={strokeSelectStyle}
            data-testid={`prop-stroke-position-${index}`}
          >
            {POSITION_OPTIONS.map((option) => (
              <option
                key={option.value}
                value={option.value}
                className="bg-[#1f2022] text-white"
              >
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className={strokeSelectWrapperClassName}>
          <select
            value={stroke.joinType}
            onChange={(event) =>
              handleJoinTypeChange(
                event.target.value as StrokeAttrs['joinType']
              )
            }
            className={strokeSelectClassName}
            style={strokeSelectStyle}
            data-testid={`prop-stroke-join-${index}`}
          >
            {JOIN_OPTIONS.map((option) => (
              <option
                key={option.value}
                value={option.value}
                className="bg-[#1f2022] text-white"
              >
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className={strokeSelectWrapperClassName}>
          <select
            value={stroke.capType}
            onChange={(event) =>
              handleCapTypeChange(event.target.value as StrokeAttrs['capType'])
            }
            className={strokeSelectClassName}
            style={strokeSelectStyle}
            data-testid={`prop-stroke-cap-${index}`}
          >
            {CAP_OPTIONS.map((option) => (
              <option
                key={option.value}
                value={option.value}
                className="bg-[#1f2022] text-white"
              >
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <PropertyControl>
          <div style={{ width: '60px' }}>
            <Input
              value={formatInputNumber(stroke.miterAngle)}
              size="small"
              suffix="°"
              containerClassName="!bg-transparent !px-0"
              containerStyle={{
                border: 'none'
              }}
              noOutline
              inputClassName="!pl-[0.5em]"
              onChange={handleMiterAngleChange}
              data-testid={`prop-stroke-miter-${index}`}
            />
          </div>
        </PropertyControl>
      </div>

      <div
        className={`grid items-center gap-1 pl-4 pr-2 h-8 min-h-8 ${
          stroke.style === StrokeStyles.DASHED
            ? 'grid-cols-[40px_minmax(72px,1fr)_48px_48px]'
            : 'grid-cols-[40px_minmax(0,1fr)]'
        }`}
      >
        <PropertyControl>
          <div style={{ width: '40px' }}>
            <Input
              value={formatInputNumber(stroke.width)}
              size="small"
              containerClassName="!bg-transparent !px-0"
              containerStyle={{
                border: 'none'
              }}
              noOutline
              inputClassName="!pl-[0.5em]"
              onChange={handleWidthChange}
              data-testid={`prop-stroke-width-${index}`}
            />
          </div>
        </PropertyControl>

        <div className={strokeSelectWrapperClassName}>
          <select
            value={stroke.style}
            onChange={(event) =>
              handleStyleChange(event.target.value as StrokeAttrs['style'])
            }
            className={strokeSelectClassName}
            style={strokeSelectStyle}
            data-testid={`prop-stroke-style-${index}`}
          >
            {STYLE_OPTIONS.map((option) => (
              <option
                key={option.value}
                value={option.value}
                className="bg-[#1f2022] text-white"
              >
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {stroke.style === StrokeStyles.DASHED && (
          <PropertyControl>
            <div style={{ width: '48px' }}>
              <Input
                value={formatInputNumber(dashGap.dash)}
                size="small"
                prefix="D"
                containerClassName="!bg-transparent !px-0"
                containerStyle={{
                  border: 'none'
                }}
                noOutline
                inputClassName="!pl-0"
                onChange={handleDashLengthChange}
                data-testid={`prop-stroke-dash-${index}`}
                aria-label="Dash length"
                title="Dash"
              />
            </div>
          </PropertyControl>
        )}

        {stroke.style === StrokeStyles.DASHED && (
          <PropertyControl>
            <div style={{ width: '48px' }}>
              <Input
                value={formatInputNumber(dashGap.gap)}
                size="small"
                prefix="G"
                containerClassName="!bg-transparent !px-0"
                containerStyle={{
                  border: 'none'
                }}
                noOutline
                inputClassName="!pl-0"
                onChange={handleGapLengthChange}
                data-testid={`prop-stroke-gap-${index}`}
                aria-label="Gap length"
                title="Gap"
              />
            </div>
          </PropertyControl>
        )}
      </div>
    </div>
  )
}

export default StrokeItem
