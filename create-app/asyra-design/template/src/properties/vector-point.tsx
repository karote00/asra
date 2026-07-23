import { Input, PropertyControl } from '@asyra/design-system'
import { type ReactNode, useCallback } from 'react'
import {
  VECTOR_TOKENS,
  getVectorPointTargetPosition,
  type VectorPointTarget
} from '@asyra/core'
import {
  isVectorHandleMode,
  VectorHandleModes,
  type VectorHandleMode,
  ROW_HEIGHT
} from '../constants'
import {
  elementApis,
  selectionApis,
  systemContextApis,
  transactionApis
} from '../common-apis'
import { useSelectedVectorPoint } from '../providers'
import { formatInputNumber, parseFiniteInputNumber } from './number-input'
import { createStructuralVectorOperationPatchIntent } from '../features/path-editing-intents'

const getTargetLabel = (target: VectorPointTarget) => {
  if (target === VECTOR_TOKENS.POINT.TARGET.IN_HANDLE) {
    return 'In Handle'
  }

  if (target === VECTOR_TOKENS.POINT.TARGET.OUT_HANDLE) {
    return 'Out Handle'
  }

  return 'Anchor'
}

const TargetHeader = ({
  index,
  target
}: {
  index: number | null
  target: VectorPointTarget
}) => (
  <div className="flex items-center justify-between h-10 pl-4 pr-2 text-[#ebebeb]">
    <span
      className="text-[11px] font-medium opacity-60 uppercase tracking-wider"
      data-testid="prop-point-id"
    >
      Point {index !== null ? index + 1 : '-'}
    </span>
    <span className="text-[10px] text-[#777]" data-testid="prop-point-target">
      {getTargetLabel(target)}
    </span>
  </div>
)

const IconToggleButton = ({
  active,
  testId,
  onClick,
  children
}: {
  active: boolean
  testId: string
  onClick: () => void
  children: ReactNode
}) => (
  <button
    type="button"
    className={`flex flex-1 items-center justify-center h-6 rounded-[6px] border transition-colors
    ${active ? 'bg-panel border-border-hover text-text-primary' : 'border-transparent text-text-secondary'}`}
    onClick={onClick}
    data-testid={testId}
    aria-pressed={active}
  >
    {children}
  </button>
)

const ToggleGroup = ({
  options
}: {
  options: {
    value: string
    label: string
    active: boolean
    onSelect: () => void
    icon: ReactNode
    testId: string
  }[]
}) => (
  <div
    className={`flex items-center pl-4 pr-2 h-${ROW_HEIGHT} min-h-${ROW_HEIGHT}`}
  >
    <div className="flex w-full h-6 items-center gap-1 rounded-[6px] bg-panel-surface border border-border-subtle">
      {options.map((option) => (
        <IconToggleButton
          key={option.value}
          active={option.active}
          testId={option.testId}
          onClick={option.onSelect}
        >
          {option.icon}
        </IconToggleButton>
      ))}
    </div>
  </div>
)

const SharpIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M6 18 L6 6 L18 6" />
  </svg>
)

const SmoothIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 16 C8 6 16 6 20 16" />
  </svg>
)

const HandleNoneIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
  >
    <circle cx="12" cy="12" r="3.2" />
  </svg>
)

const HandleMirrorAngleIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M6 18 L12 12 L18 9" />
    <circle cx="12" cy="12" r="2.2" />
  </svg>
)

const HandleMirrorAngleLengthIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 12 L19 12" />
    <circle cx="12" cy="12" r="2.2" />
  </svg>
)

const AnchorControls = ({
  pointType,
  handleMode,
  onChangePointType,
  onChangeHandleMode
}: {
  pointType: 'smooth' | 'sharp'
  handleMode: VectorHandleMode
  onChangePointType: (value: 'smooth' | 'sharp') => void
  onChangeHandleMode: (value: VectorHandleMode) => void
}) => (
  <div className="grid grid-cols-1 w-full">
    <ToggleGroup
      options={[
        {
          value: 'sharp',
          label: 'Sharp',
          active: pointType === 'sharp',
          onSelect: () => onChangePointType('sharp'),
          icon: <SharpIcon />,
          testId: 'prop-point-type-sharp'
        },
        {
          value: 'smooth',
          label: 'Smooth',
          active: pointType === 'smooth',
          onSelect: () => onChangePointType('smooth'),
          icon: <SmoothIcon />,
          testId: 'prop-point-type-smooth'
        }
      ]}
    />
    <ToggleGroup
      options={[
        {
          value: VectorHandleModes.NONE,
          label: 'None',
          active: handleMode === VectorHandleModes.NONE,
          onSelect: () => onChangeHandleMode(VectorHandleModes.NONE),
          icon: <HandleNoneIcon />,
          testId: 'prop-handle-mode-none'
        },
        {
          value: VectorHandleModes.MIRROR_ANGLE,
          label: 'Mirror Angle',
          active: handleMode === VectorHandleModes.MIRROR_ANGLE,
          onSelect: () => onChangeHandleMode(VectorHandleModes.MIRROR_ANGLE),
          icon: <HandleMirrorAngleIcon />,
          testId: 'prop-handle-mode-mirror-angle'
        },
        {
          value: VectorHandleModes.MIRROR_ANGLE_LENGTH,
          label: 'Mirror Angle + Length',
          active: handleMode === VectorHandleModes.MIRROR_ANGLE_LENGTH,
          onSelect: () =>
            onChangeHandleMode(VectorHandleModes.MIRROR_ANGLE_LENGTH),
          icon: <HandleMirrorAngleLengthIcon />,
          testId: 'prop-handle-mode-mirror-angle-length'
        }
      ]}
    />
  </div>
)

const CoordinateInputs = ({
  x,
  y,
  onChangeX,
  onChangeY
}: {
  x: number
  y: number
  onChangeX: (value: string) => boolean
  onChangeY: (value: string) => boolean
}) => (
  <div className="grid grid-cols-2 items-center gap-2 pl-4 pr-2 h-8 min-h-8">
    <PropertyControl>
      <Input
        value={formatInputNumber(x)}
        prefix="X"
        onChange={onChangeX}
        noOutline
        data-testid="prop-vector-point-x"
      />
    </PropertyControl>
    <PropertyControl>
      <Input
        value={formatInputNumber(y)}
        prefix="Y"
        onChange={onChangeY}
        noOutline
        data-testid="prop-vector-point-y"
      />
    </PropertyControl>
  </div>
)

const VectorPoint = () => {
  const selectedPoint = useSelectedVectorPoint()
  const elementId = selectedPoint?.elementId ?? null
  const pointId = selectedPoint?.pointId ?? null
  const index = selectedPoint?.index ?? null
  const target = selectedPoint?.target ?? VECTOR_TOKENS.POINT.TARGET.ANCHOR
  const x = selectedPoint?.x ?? null
  const y = selectedPoint?.y ?? null
  const anchorPoint =
    elementId && pointId
      ? (elementApis.getVectorAnchorPointById(elementId, pointId)?.point ??
        null)
      : null
  const pointType = anchorPoint?.type ?? 'sharp'
  const selectedHandleMode = selectedPoint?.handleMode
  const handleMode = isVectorHandleMode(selectedHandleMode)
    ? selectedHandleMode
    : elementId && pointId
      ? elementApis.getVectorAnchorPointHandleMode(elementId, pointId)
      : VectorHandleModes.NONE

  const applyTargetSelection = useCallback(
    (
      updatedPoint: {
        point: {
          x: number
          y: number
          inHandle: { x: number; y: number } | null
          outHandle: { x: number; y: number } | null
        }
        index: number
      } | null,
      nextTarget: VectorPointTarget
    ) => {
      if (!elementId || !pointId || !updatedPoint) {
        return false
      }

      const targetPosition = getVectorPointTargetPosition(
        updatedPoint.point,
        nextTarget
      )

      if (!targetPosition) {
        return false
      }

      selectionApis.selectVectorPoint({
        elementId,
        pointId,
        target: nextTarget
      })
      // Compatibility mirror during SelectionManager migration.
      systemContextApis.setSelectedVectorPoint({
        elementId,
        pointId,
        index: updatedPoint.index,
        target: nextTarget,
        x: targetPosition.x,
        y: targetPosition.y,
        handleMode: elementApis.getVectorAnchorPointHandleMode(
          elementId,
          pointId
        )
      })
      return true
    },
    [elementId, pointId]
  )

  const runDiscreteVectorPointInteraction = useCallback(
    <T,>(action: () => T) => transactionApis.runTransaction(action),
    []
  )

  const createHandlePositionStructuralIntent = useCallback(() => {
    if (
      !elementId ||
      !pointId ||
      target === VECTOR_TOKENS.POINT.TARGET.ANCHOR
    ) {
      return null
    }

    return createStructuralVectorOperationPatchIntent({
      elementId,
      operation: 'update-handle-position',
      inputIds: [pointId, target],
      changedRecords:
        target === VECTOR_TOKENS.POINT.TARGET.IN_HANDLE
          ? ['point:inHandle']
          : ['point:outHandle'],
      undoable: true
    })
  }, [elementId, pointId, target])

  const handleChangeX = useCallback(
    (newValue: string) => {
      if (!elementId || !pointId || x === null || y === null) {
        return false
      }

      const nextX = parseFiniteInputNumber(newValue)
      if (nextX === null) {
        return false
      }

      return runDiscreteVectorPointInteraction(() => {
        const structuralOperationIntent = createHandlePositionStructuralIntent()
        if (
          target !== VECTOR_TOKENS.POINT.TARGET.ANCHOR &&
          !structuralOperationIntent
        ) {
          return false
        }

        const updatedPoint =
          target === VECTOR_TOKENS.POINT.TARGET.ANCHOR
            ? elementApis.updateVectorAnchorPointPosition(elementId, pointId, {
                x: nextX,
                y
              })
            : elementApis.updateVectorAnchorPointHandlePosition(
                elementId,
                pointId,
                target,
                {
                  x: nextX,
                  y
                },
                {
                  structuralOperationIntent
                }
              )
        return updatedPoint === true
          ? false
          : applyTargetSelection(updatedPoint, target)
      })
    },
    [
      elementId,
      pointId,
      x,
      y,
      target,
      applyTargetSelection,
      createHandlePositionStructuralIntent,
      runDiscreteVectorPointInteraction
    ]
  )

  const handleChangeY = useCallback(
    (newValue: string) => {
      if (!elementId || !pointId || x === null || y === null) {
        return false
      }

      const nextY = parseFiniteInputNumber(newValue)
      if (nextY === null) {
        return false
      }

      return runDiscreteVectorPointInteraction(() => {
        const structuralOperationIntent = createHandlePositionStructuralIntent()
        if (
          target !== VECTOR_TOKENS.POINT.TARGET.ANCHOR &&
          !structuralOperationIntent
        ) {
          return false
        }

        const updatedPoint =
          target === VECTOR_TOKENS.POINT.TARGET.ANCHOR
            ? elementApis.updateVectorAnchorPointPosition(elementId, pointId, {
                x,
                y: nextY
              })
            : elementApis.updateVectorAnchorPointHandlePosition(
                elementId,
                pointId,
                target,
                {
                  x,
                  y: nextY
                },
                {
                  structuralOperationIntent
                }
              )
        return updatedPoint === true
          ? false
          : applyTargetSelection(updatedPoint, target)
      })
    },
    [
      elementId,
      pointId,
      x,
      y,
      target,
      applyTargetSelection,
      createHandlePositionStructuralIntent,
      runDiscreteVectorPointInteraction
    ]
  )

  const handleChangePointType = useCallback(
    (newType: 'smooth' | 'sharp') => {
      if (!elementId || !pointId) {
        return
      }

      runDiscreteVectorPointInteraction(() => {
        const structuralOperationIntent =
          createStructuralVectorOperationPatchIntent({
            elementId,
            operation: 'set-anchor-type',
            inputIds: [pointId],
            changedRecords: ['point:type'],
            undoable: true
          })
        if (!structuralOperationIntent) {
          return
        }

        const updatedPoint = elementApis.updateVectorAnchorPointType(
          elementId,
          pointId,
          newType,
          {
            structuralOperationIntent
          }
        )
        applyTargetSelection(updatedPoint, VECTOR_TOKENS.POINT.TARGET.ANCHOR)
      })
    },
    [
      elementId,
      pointId,
      applyTargetSelection,
      runDiscreteVectorPointInteraction
    ]
  )

  const handleChangeHandleMode = useCallback(
    (newMode: VectorHandleMode) => {
      if (!elementId || !pointId) {
        return
      }

      runDiscreteVectorPointInteraction(() => {
        const structuralOperationIntent =
          createStructuralVectorOperationPatchIntent({
            elementId,
            operation: 'set-handle-mode',
            inputIds: [pointId],
            changedRecords: ['point:handleMode'],
            undoable: true
          })
        if (!structuralOperationIntent) {
          return
        }

        const updatedPoint = elementApis.setVectorAnchorPointHandleMode(
          elementId,
          pointId,
          newMode,
          {
            structuralOperationIntent
          }
        )
        if (!updatedPoint) {
          return
        }

        applyTargetSelection(updatedPoint, target)
      })
    },
    [
      elementId,
      pointId,
      applyTargetSelection,
      target,
      runDiscreteVectorPointInteraction
    ]
  )

  if (!elementId || !pointId || x === null || y === null || !anchorPoint) {
    return null
  }

  return (
    <>
      <TargetHeader index={index} target={target} />
      {target === VECTOR_TOKENS.POINT.TARGET.ANCHOR && (
        <AnchorControls
          pointType={pointType}
          handleMode={handleMode}
          onChangePointType={handleChangePointType}
          onChangeHandleMode={handleChangeHandleMode}
        />
      )}
      <CoordinateInputs
        x={x}
        y={y}
        onChangeX={handleChangeX}
        onChangeY={handleChangeY}
      />
    </>
  )
}

export default VectorPoint
