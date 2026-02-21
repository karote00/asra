import { Input } from '@asyra/design-system'
import { useCallback } from 'react'
import { elementApis, systemContextApis } from '../common-apis'
import { useSelectedVectorPoint } from '../providers'

const VectorPoint = () => {
  const selectedPoint = useSelectedVectorPoint()
  const elementId = selectedPoint?.elementId ?? null
  const pointId = selectedPoint?.pointId ?? null
  const index = selectedPoint?.index ?? null
  const x = selectedPoint?.x ?? null
  const y = selectedPoint?.y ?? null

  const handleChangeX = useCallback(
    (newValue: string) => {
      if (!elementId || !pointId || x === null || y === null) {
        return
      }

      const nextX = Number(newValue)
      if (Number.isNaN(nextX)) {
        return
      }

      const updatedPoint = elementApis.updateVectorAnchorPointPosition(
        elementId,
        pointId,
        { x: nextX, y }
      )
      if (!updatedPoint) {
        return
      }

      systemContextApis.setSelectedVectorPoint({
        elementId,
        pointId,
        index: updatedPoint.index,
        x: updatedPoint.point.x,
        y: updatedPoint.point.y
      })
    },
    [elementId, pointId, x, y]
  )

  const handleChangeY = useCallback(
    (newValue: string) => {
      if (!elementId || !pointId || x === null || y === null) {
        return
      }

      const nextY = Number(newValue)
      if (Number.isNaN(nextY)) {
        return
      }

      const updatedPoint = elementApis.updateVectorAnchorPointPosition(
        elementId,
        pointId,
        { x, y: nextY }
      )
      if (!updatedPoint) {
        return
      }

      systemContextApis.setSelectedVectorPoint({
        elementId,
        pointId,
        index: updatedPoint.index,
        x: updatedPoint.point.x,
        y: updatedPoint.point.y
      })
    },
    [elementId, pointId, x, y]
  )

  if (!elementId || !pointId || x === null || y === null) {
    return null
  }

  return (
    <>
      <div className="px-3 pt-2 text-xs text-gray-400" data-testid="prop-point-id">
        Point {index !== null ? index + 1 : '-'}
      </div>
      <div className="flex items-center gap-2 text-gray-200 w-full px-3 py-1">
        <div className="w-1/2">
          <Input
            value={x}
            prefix="X"
            onChange={handleChangeX}
            data-testid="prop-point-x"
          />
        </div>
        <div className="w-1/2">
          <Input
            value={y}
            prefix="Y"
            onChange={handleChangeY}
            data-testid="prop-point-y"
          />
        </div>
      </div>
    </>
  )
}

export default VectorPoint
