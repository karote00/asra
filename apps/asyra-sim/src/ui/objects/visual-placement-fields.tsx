import type { VisualBinding } from '../../domain/workcell'
import { VectorField } from '../shared/fields'
import { RotationFields } from './rotation-fields'

type Placement = Pick<VisualBinding, 'pose' | 'scale'>

export function VisualPlacementFields({
  value,
  onChange
}: {
  value: Placement
  onChange: (placement: Placement) => void
}) {
  return (
    <>
      <VectorField
        label="Visual position (m)"
        value={value.pose.position}
        onChange={(position) =>
          onChange({ ...value, pose: { ...value.pose, position } })
        }
      />

      <VectorField
        label="Visual scale"
        value={value.scale}
        onChange={(scale) => onChange({ ...value, scale })}
      />

      <details>
        <summary>Visual rotation</summary>

        <p className="hint text-[10px] leading-[1.6] text-sim-muted font-normal">
          Body-local quaternion:{' '}
          {value.pose.rotation.map((entry) => entry.toFixed(4)).join(', ')}. Set
          an absolute axis-angle rotation.
        </p>

        <RotationFields
          axisLabel="Visual rotation axis"
          angleLabel="Visual rotation (deg)"
          value={value.pose.rotation}
          onChange={(rotation) =>
            onChange({ ...value, pose: { ...value.pose, rotation } })
          }
        />
      </details>
    </>
  )
}
