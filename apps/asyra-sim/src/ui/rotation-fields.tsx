import { useState } from 'react'
import {
  axisAngle,
  normalize,
  type Quaternion,
  type Vec3
} from '../domain/math'
import { NumberField, VectorField } from './fields'

export function RotationFields({
  value,
  onChange,
  axisLabel,
  angleLabel,
  angleScale = 180 / Math.PI
}: {
  value: Quaternion
  onChange: (value: Quaternion) => void
  axisLabel: string
  angleLabel: string
  angleScale?: number
}) {
  // Identity has no unique axis. This choice is presentation state only.
  const [identityAxis, setIdentityAxis] = useState<Vec3>([0, 1, 0])
  const [error, setError] = useState('')
  const sine = Math.hypot(value[0], value[1], value[2])
  const axis: Vec3 =
    sine > 1e-12
      ? [value[0] / sine, value[1] / sine, value[2] / sine]
      : identityAxis
  const angle = 2 * Math.atan2(sine, value[3])
  return (
    <>
      <VectorField
        label={axisLabel}
        value={axis}
        onChange={(next) => {
          try {
            const unit = normalize(next)
            if (sine <= 1e-12) setIdentityAxis(unit)
            else onChange(axisAngle(unit, angle))
            setError('')
          } catch (reason) {
            setError(reason instanceof Error ? reason.message : String(reason))
          }
        }}
      />
      <NumberField
        label={angleLabel}
        value={Number((angle * angleScale).toPrecision(10))}
        onChange={(next) => {
          onChange(axisAngle(axis, next / angleScale))
          setError('')
        }}
      />
      {error && (
        <p role="alert" className="inline-error">
          {error}
        </p>
      )}
    </>
  )
}
