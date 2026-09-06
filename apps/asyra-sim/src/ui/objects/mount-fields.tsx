import { memo } from 'react'
import type { Body } from '../../domain/workcell'
import { VectorField } from '../shared/fields'
import { equalPose } from './equal-fields'
import { RotationFields } from './rotation-fields'

export const MountFields = memo(
  function MountFields({
    pose,
    update,
    lengthUnit,
    angleUnit,
    lengthScale,
    angleScale
  }: {
    pose: Body['pose']
    lengthUnit: string
    angleUnit: string
    lengthScale: number
    angleScale: number
    update: (patch: Partial<Body>) => void
  }) {
    return (
      <>
        <VectorField
          label={`Mount position (${lengthUnit})`}
          value={pose.position}
          scale={lengthScale}
          onChange={(position) =>
            update({
              pose: { ...pose, position }
            })
          }
        />

        <details>
          <summary>Mount rotation</summary>

          <p className="hint text-[10px] leading-[1.6] text-sim-muted font-normal">
            Set an absolute axis-angle rotation. Current quaternion:{' '}
            {pose.rotation.map((v) => v.toFixed(4)).join(', ')}.
          </p>

          <RotationFields
            axisLabel="Rotation axis"
            angleLabel={`Rotation angle (${angleUnit})`}
            angleScale={angleScale}
            value={pose.rotation}
            onChange={(rotation) =>
              update({
                pose: { ...pose, rotation }
              })
            }
          />
        </details>
      </>
    )
  },
  (a, b) =>
    equalPose(a.pose, b.pose) &&
    a.lengthUnit === b.lengthUnit &&
    a.angleUnit === b.angleUnit &&
    a.lengthScale === b.lengthScale &&
    a.angleScale === b.angleScale &&
    a.update === b.update
)
