import type { Body } from '../../domain/workcell'
import { VectorField } from '../shared/fields'
import { RotationFields } from './rotation-fields'
import {
  useBodyPose,
  useDisplayUnits,
  type BodySource,
  type DisplayUnits
} from './body-subscriptions'
import type { ReadonlyView } from '../shared/view-source'

export function MountFields({
  source,
  units,
  update
}: {
  source: BodySource
  units: ReadonlyView<DisplayUnits>
  update: (patch: Partial<Body>) => void
}) {
  const pose = useBodyPose(source)

  const { lengthUnit, angleUnit, lengthScale, angleScale } =
    useDisplayUnits(units)

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
}
