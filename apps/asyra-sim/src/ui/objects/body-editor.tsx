import { useState } from 'react'
import type { Body, Workcell } from '../../domain/workcell'
import { CommittedInput } from '../shared/fields'
import { JointFields } from './joint-fields'
import { MountFields } from './mount-fields'
import { NativeParts } from './native-parts'
import { OriginalParts } from './original-parts'
import { useBodyUpdate } from './use-body-update'

export function BodyEditor({
  body,
  workcell,
  onChange,
  onRemove
}: {
  body: Body
  workcell: Workcell
  onChange: (body: Body) => Promise<void>
  onRemove: () => void
}) {
  const update = useBodyUpdate(body, onChange)

  const [lengthUnit, setLengthUnit] = useState<'m' | 'mm'>('m')

  const [angleUnit, setAngleUnit] = useState<'rad' | 'deg'>('deg')

  const lengthScale = lengthUnit === 'mm' ? 1000 : 1

  const angleScale = angleUnit === 'deg' ? 180 / Math.PI : 1

  return (
    <div
      className="body-editor h-full flex flex-col [&_>_.panel-heading]:border-b
        [&_>_.panel-heading]:border-b-sim-divider [&_>_.panel-heading]:min-h-21
        [&_>_.panel-heading]:flex-none [&_h2]:max-w-50 [&_h2]:wrap-anywhere"
    >
      <div
        className="panel-heading flex items-center justify-between pt-[23px] px-5 pb-[17px]
          gap-[10px] [&_h2]:mt-[6px]"
      >
        <div>
          <span className="eyebrow text-[9px] tracking-[1.3px] text-sim-muted font-bold">
            PROPERTIES
          </span>

          <h2>{body.name}</h2>
        </div>

        <span className="role-tag text-[10px] bg-sim-subtle text-sim-secondary py-1 px-[7px] rounded-[4px]">
          {body.role}
        </span>
      </div>

      <div className="editor-content pt-[18px] px-[18px] pb-6 overflow-auto flex flex-col gap-[17px] flex-1 min-h-0">
        <OriginalParts bindings={body.visuals} update={update} />

        <label>
          Name
          <CommittedInput
            aria-label="Object name"
            maxLength={200}
            value={body.name}
            onCommit={(name) =>
              update({
                name
              })
            }
          />
        </label>

        <div className="field-pair grid grid-cols-[1fr_1fr] gap-[10px]">
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
            value={body.parentId ?? ''}
            onChange={(event) =>
              update({
                parentId: event.target.value || null
              })
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
            value={body.role}
            onChange={(event) =>
              update({
                role: event.target.value as Body['role']
              })
            }
          >
            {['robot', 'link', 'tool', 'workpiece', 'fixture', 'group'].map(
              (role) => (
                <option key={role}>{role}</option>
              )
            )}
          </select>
        </label>

        <MountFields
          pose={body.pose}
          update={update}
          lengthUnit={lengthUnit}
          angleUnit={angleUnit}
          lengthScale={lengthScale}
          angleScale={angleScale}
        />

        <JointFields
          joint={body.joint}
          update={update}
          lengthUnit={lengthUnit}
          angleUnit={angleUnit}
          lengthScale={lengthScale}
          angleScale={angleScale}
        />

        {!body.visuals?.length && (
          <NativeParts
            body={body}
            update={update}
            lengthUnit={lengthUnit}
            lengthScale={lengthScale}
          />
        )}

        <label className="checkbox flex-row items-center gap-[6px] [&_span]:text-sim-muted [&_span]:font-normal">
          <input
            type="checkbox"
            checked={body.visible}
            onChange={(event) =>
              update({
                visible: event.target.checked
              })
            }
          />
          Visible in viewport <span>(not analysis scope)</span>
        </label>

        <label>
          Display color
          <CommittedInput
            aria-label="Display color"
            type="color"
            value={`#${body.color.toString(16).padStart(6, '0')}`}
            onCommit={(color) =>
              update({
                color: parseInt(color.slice(1), 16)
              })
            }
          />
        </label>

        <button
          className="text-button border-0 py-[5px] px-0 bg-transparent text-[11px] text-left danger text-sim-error-text"
          type="button"
          onClick={onRemove}
        >
          Delete object and descendants
        </button>
      </div>
    </div>
  )
}
