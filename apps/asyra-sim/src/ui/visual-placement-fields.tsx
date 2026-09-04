import { useState } from 'react'
import { axisAngle, type Vec3 } from '../domain/math'
import type { VisualBinding } from '../domain/workcell'
import { NumberField, VectorField } from './fields'

type Placement = Pick<VisualBinding, 'pose' | 'scale'>

export function VisualPlacementFields({
  value,
  onChange
}: {
  value: Placement
  onChange: (placement: Placement) => void
}) {
  const [axis, setAxis] = useState<Vec3>([0, 1, 0]),
    [angle, setAngle] = useState(0),
    [error, setError] = useState('')
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
        <p className="hint">
          Body-local quaternion:{' '}
          {value.pose.rotation.map((entry) => entry.toFixed(4)).join(', ')}. Set
          an absolute axis-angle rotation.
        </p>
        <VectorField
          label="Visual rotation axis"
          value={axis}
          onChange={setAxis}
        />
        <NumberField
          label="Visual rotation (deg)"
          value={angle}
          onChange={setAngle}
        />
        <button
          type="button"
          onClick={() => {
            try {
              onChange({
                ...value,
                pose: {
                  ...value.pose,
                  rotation: axisAngle(axis, (angle * Math.PI) / 180)
                }
              })
              setError('')
            } catch (reason) {
              setError(
                reason instanceof Error ? reason.message : String(reason)
              )
            }
          }}
        >
          Set visual rotation
        </button>
        {error && <p className="inline-error">{error}</p>}
      </details>
    </>
  )
}
