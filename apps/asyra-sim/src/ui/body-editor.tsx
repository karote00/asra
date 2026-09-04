import { useState } from 'react'
import { IDENTITY_POSE, axisAngle, type Vec3 } from '../domain/math'
import type { Body, Collider, Geometry, Workcell } from '../domain/workcell'
import { NumberField, VectorField } from './fields'

function newGeometry(kind: string): Geometry {
  if (kind === 'box') return { kind: 'box', size: [0.2, 0.2, 0.2] }
  if (kind === 'sphere') return { kind: 'sphere', radius: 0.1 }
  return { kind: 'capsule', radius: 0.1, length: 0.3 }
}

export function BodyEditor({
  body,
  workcell,
  onApply,
  onRemove
}: {
  body: Body
  workcell: Workcell
  onApply: (body: Body) => Promise<void>
  onRemove: () => void
}) {
  const [draft, setDraft] = useState<Body>(() => structuredClone(body))
  const [lengthUnit, setLengthUnit] = useState<'m' | 'mm'>('m')
  const [angleUnit, setAngleUnit] = useState<'rad' | 'deg'>('deg')
  const [axis, setAxis] = useState<Vec3>([0, 1, 0]),
    [angle, setAngle] = useState(0)
  const lengthScale = lengthUnit === 'mm' ? 1000 : 1,
    angleScale = angleUnit === 'deg' ? 180 / Math.PI : 1
  const shape = (id: string, change: Partial<Collider>) =>
    setDraft({
      ...draft,
      colliders: draft.colliders.map((item) =>
        item.id === id ? { ...item, ...change } : item
      )
    })
  const geometry = (id: string, value: Geometry) =>
    shape(id, { geometry: value })
  const dirty = JSON.stringify(draft) !== JSON.stringify(body)
  return (
    <form
      className="body-editor"
      onSubmit={(event) => {
        event.preventDefault()
        void onApply(draft)
      }}
    >
      <div className="panel-heading">
        <div>
          <span className="eyebrow">PROPERTIES</span>
          <h2>{body.name}</h2>
        </div>
        <span className="role-tag">{body.role}</span>
      </div>
      <div className="editor-content">
        <label>
          Name
          <input
            aria-label="Object name"
            maxLength={200}
            value={draft.name}
            onChange={(event) =>
              setDraft({ ...draft, name: event.target.value })
            }
          />
        </label>
        <div className="field-pair">
          <label>
            Length unit
            <select
              aria-label="Length unit"
              value={lengthUnit}
              onChange={(event) =>
                setLengthUnit(event.target.value as 'm' | 'mm')
              }
            >
              <option value="m">Meters (m)</option>
              <option value="mm">Millimeters (mm)</option>
            </select>
          </label>
          <label>
            Angle unit
            <select
              aria-label="Angle unit"
              value={angleUnit}
              onChange={(event) =>
                setAngleUnit(event.target.value as 'deg' | 'rad')
              }
            >
              <option value="deg">Degrees (°)</option>
              <option value="rad">Radians</option>
            </select>
          </label>
        </div>
        <label>
          Parent frame
          <select
            aria-label="Parent frame"
            value={draft.parentId ?? ''}
            onChange={(event) =>
              setDraft({ ...draft, parentId: event.target.value || null })
            }
          >
            <option value="">Workcell origin</option>
            {workcell.bodies
              .filter((item) => item.id !== body.id)
              .map((item) => (
                <option value={item.id} key={item.id}>
                  {item.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Body role
          <select
            aria-label="Body role"
            value={draft.role}
            onChange={(event) =>
              setDraft({ ...draft, role: event.target.value as Body['role'] })
            }
          >
            {['robot', 'link', 'tool', 'workpiece', 'fixture', 'group'].map(
              (role) => (
                <option key={role}>{role}</option>
              )
            )}
          </select>
        </label>
        <VectorField
          label={`Mount position (${lengthUnit})`}
          value={draft.pose.position}
          scale={lengthScale}
          onChange={(position) =>
            setDraft({ ...draft, pose: { ...draft.pose, position } })
          }
        />
        <details>
          <summary>Mount rotation</summary>
          <p className="hint">
            Set an absolute axis-angle rotation. Current quaternion:{' '}
            {draft.pose.rotation.map((v) => v.toFixed(4)).join(', ')}.
          </p>
          <VectorField label="Rotation axis" value={axis} onChange={setAxis} />
          <NumberField
            label={`Rotation angle (${angleUnit})`}
            value={angle}
            onChange={setAngle}
          />
          <button
            type="button"
            onClick={() => {
              if (Math.hypot(...axis) > 0)
                setDraft({
                  ...draft,
                  pose: {
                    ...draft.pose,
                    rotation: axisAngle(axis, angle / angleScale)
                  }
                })
            }}
          >
            Set mount rotation
          </button>
        </details>
        <details open={draft.joint.kind !== 'fixed'}>
          <summary>
            Joint definition <span>{draft.joint.kind}</span>
          </summary>
          <label>
            Joint type
            <select
              aria-label="Joint type"
              value={draft.joint.kind}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  joint: {
                    ...draft.joint,
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
          {draft.joint.kind !== 'fixed' && (
            <>
              <VectorField
                label="Joint axis"
                value={draft.joint.axis}
                onChange={(axis) =>
                  setDraft({ ...draft, joint: { ...draft.joint, axis } })
                }
              />
              {(['min', 'value', 'max'] as const).map((key) => (
                <NumberField
                  key={key}
                  label={`Joint ${key} (${draft.joint.kind === 'revolute' ? angleUnit : lengthUnit})`}
                  value={Number(
                    (
                      draft.joint[key] *
                      (draft.joint.kind === 'revolute'
                        ? angleScale
                        : lengthScale)
                    ).toPrecision(10)
                  )}
                  onChange={(value) =>
                    setDraft({
                      ...draft,
                      joint: {
                        ...draft.joint,
                        [key]:
                          value /
                          (draft.joint.kind === 'revolute'
                            ? angleScale
                            : lengthScale)
                      }
                    })
                  }
                />
              ))}
            </>
          )}
        </details>
        <section className="shape-list">
          <div className="section-heading">
            <h3>Analysis geometry</h3>
            <span>{draft.colliders.length} shapes</span>
          </div>
          <p className="hint">
            Explicit geometric proxies. They are not certified to enclose the
            real equipment.
          </p>
          {draft.colliders.map((collider, index) => (
            <details key={collider.id} open>
              <summary>
                Shape {index + 1}
                <span>{collider.geometry.kind}</span>
              </summary>
              <label>
                Shape type
                <select
                  aria-label={`Shape ${index + 1} type`}
                  value={collider.geometry.kind}
                  onChange={(event) =>
                    geometry(collider.id, newGeometry(event.target.value))
                  }
                >
                  <option>box</option>
                  <option>sphere</option>
                  <option>capsule</option>
                </select>
              </label>
              {collider.geometry.kind === 'box' ? (
                <VectorField
                  label={`Shape ${index + 1} size (${lengthUnit})`}
                  value={collider.geometry.size}
                  scale={lengthScale}
                  onChange={(size) =>
                    geometry(collider.id, { kind: 'box', size })
                  }
                />
              ) : (
                <>
                  <NumberField
                    label={`Shape ${index + 1} radius (${lengthUnit})`}
                    value={collider.geometry.radius * lengthScale}
                    onChange={(radius) =>
                      geometry(collider.id, {
                        ...collider.geometry,
                        radius: radius / lengthScale
                      } as Geometry)
                    }
                  />
                  {collider.geometry.kind === 'capsule' && (
                    <NumberField
                      label={`Shape ${index + 1} length (${lengthUnit})`}
                      value={collider.geometry.length * lengthScale}
                      onChange={(length) =>
                        geometry(collider.id, {
                          ...collider.geometry,
                          length: length / lengthScale
                        } as Geometry)
                      }
                    />
                  )}
                </>
              )}
              <VectorField
                label={`Shape ${index + 1} offset (${lengthUnit})`}
                value={collider.pose.position}
                scale={lengthScale}
                onChange={(position) =>
                  shape(collider.id, { pose: { ...collider.pose, position } })
                }
              />
              <button
                type="button"
                className="text-button danger"
                onClick={() =>
                  setDraft({
                    ...draft,
                    colliders: draft.colliders.filter(
                      (item) => item.id !== collider.id
                    )
                  })
                }
              >
                Remove shape
              </button>
            </details>
          ))}
          <button
            type="button"
            className="wide"
            onClick={() =>
              setDraft({
                ...draft,
                colliders: [
                  ...draft.colliders,
                  {
                    id: crypto.randomUUID(),
                    geometry: { kind: 'box', size: [0.2, 0.2, 0.2] },
                    pose: IDENTITY_POSE
                  }
                ]
              })
            }
          >
            + Add analysis shape
          </button>
        </section>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={draft.visible}
            onChange={(event) =>
              setDraft({ ...draft, visible: event.target.checked })
            }
          />
          Visible in viewport <span>(not analysis scope)</span>
        </label>
        <label>
          Display color
          <input
            aria-label="Display color"
            type="color"
            value={`#${draft.color.toString(16).padStart(6, '0')}`}
            onChange={(event) =>
              setDraft({
                ...draft,
                color: parseInt(event.target.value.slice(1), 16)
              })
            }
          />
        </label>
        <button className="text-button danger" type="button" onClick={onRemove}>
          Delete object and descendants
        </button>
      </div>
      <div className="editor-actions">
        <button
          type="button"
          disabled={!dirty}
          onClick={() => setDraft(structuredClone(body))}
        >
          Reset
        </button>
        <button type="submit" className="primary" disabled={!dirty}>
          Apply changes
        </button>
      </div>
    </form>
  )
}
