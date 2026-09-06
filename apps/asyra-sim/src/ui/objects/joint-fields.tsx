import { memo } from 'react'
import type { Body } from '../../domain/workcell'
import { NumberField, VectorField } from '../shared/fields'
import { equalJoint } from './equal-fields'

export const JointFields = memo(
  function JointFields({
    joint,
    update,
    lengthUnit,
    angleUnit,
    lengthScale,
    angleScale
  }: {
    joint: Body['joint']
    lengthUnit: string
    angleUnit: string
    lengthScale: number
    angleScale: number
    update: (patch: Partial<Body>) => void
  }) {
    return (
      <details open={joint.kind !== 'fixed'}>
        <summary>
          Joint definition <span>{joint.kind}</span>
        </summary>

        <label>
          Joint type
          <select
            aria-label="Joint type"
            value={joint.kind}
            onChange={(event) =>
              update({
                joint: {
                  ...joint,
                  kind: event.target.value as Body['joint']['kind']
                }
              })
            }
          >
            <option>fixed</option>

            <option>revolute</option>

            <option>prismatic</option>
          </select>
        </label>

        {joint.kind !== 'fixed' && (
          <>
            <VectorField
              label="Joint axis"
              value={joint.axis}
              onChange={(axis) =>
                update({
                  joint: { ...joint, axis }
                })
              }
            />

            {(['min', 'value', 'max'] as const).map((key) => (
              <NumberField
                key={key}
                label={`Joint ${key} (${joint.kind === 'revolute' ? angleUnit : lengthUnit})`}
                value={Number(
                  (
                    joint[key] *
                    (joint.kind === 'revolute' ? angleScale : lengthScale)
                  ).toPrecision(10)
                )}
                onChange={(value) =>
                  update({
                    joint: {
                      ...joint,
                      [key]:
                        value /
                        (joint.kind === 'revolute' ? angleScale : lengthScale)
                    }
                  })
                }
              />
            ))}
          </>
        )}
      </details>
    )
  },
  (a, b) =>
    equalJoint(a.joint, b.joint) &&
    a.lengthUnit === b.lengthUnit &&
    a.angleUnit === b.angleUnit &&
    a.lengthScale === b.lengthScale &&
    a.angleScale === b.angleScale &&
    a.update === b.update
)
