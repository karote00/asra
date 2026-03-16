import {
  FillGradientTypes,
  type EVENT_OPTIONS,
  type FillAttrs,
  type FillGradientData,
  type FillGradientType
} from '@asyra/utils'
import type { FillPatch } from '../../common-apis'
import GradientStopsList from './gradient-stops-list'
import GradientStrip from './gradient-strip'
import GradientTypeControls from './gradient-type-controls'
import { useGradientInteractions } from './use-gradient-interactions'

interface GradientEditorProps {
  index: number
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
  embedded?: boolean
}

const GRADIENT_TYPE_OPTIONS: FillGradientType[] = [
  FillGradientTypes.LINEAR,
  FillGradientTypes.RADIAL,
  FillGradientTypes.ANGULAR,
  FillGradientTypes.DIAMOND
]

const GradientEditor = ({
  index,
  fill,
  fillId,
  ownerElementId,
  gradient,
  onChangeFill,
  onStartInteraction,
  onEndInteraction,
  embedded = false
}: GradientEditorProps) => {
  const {
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
  } = useGradientInteractions({
    fill,
    fillId,
    ownerElementId,
    gradient,
    onChangeFill,
    onStartInteraction,
    onEndInteraction
  })

  return (
    <div
      className={
        embedded
          ? 'w-full'
          : 'w-full rounded-md border border-border-dark bg-[#1f2022] p-2'
      }
      data-testid={`prop-fill-gradient-editor-${index}`}
    >
      <GradientTypeControls
        index={index}
        value={gradient.gradientType as FillGradientType}
        options={GRADIENT_TYPE_OPTIONS}
        onChange={handleGradientTypeChange}
        onFlip={handleFlipGradient}
      />

      <GradientStrip
        index={index}
        gradient={gradient}
        selectedStopIndex={selectedStopIndex}
        openStopIndex={openStopIndex}
        stripRef={stripRef}
        onAddStopFromStrip={handleAddStop}
        onSelectStop={handleSelectStop}
        onStopPointerDown={beginStopDrag}
      />

      <GradientStopsList
        index={index}
        orderedStops={orderedStops}
        selectedStopIndex={selectedStopIndex}
        openStopIndex={openStopIndex}
        fillColorFormat={fill.colorFormat}
        totalStopCount={gradient.gradientStops.length}
        onAddStop={handleAddStopFromButton}
        onSelectStop={handleSelectStop}
        onRowPointerDown={handleStopRowPointerDown}
        onStopPositionChange={handleStopPositionChange}
        onStopColorChange={handleStopColorChange}
        onStopColorTextChange={handleStopColorTextChange}
        onStopOpacityChange={handleStopOpacityChange}
        onRemoveStop={handleRemoveStop}
        onOpenStopChange={handleOpenStopChange}
        onColorPickerStart={startInteractionSession}
        onColorPickerEnd={endInteractionSession}
      />
    </div>
  )
}

export default GradientEditor
