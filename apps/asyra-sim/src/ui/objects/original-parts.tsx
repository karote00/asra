import type { Body } from '../../domain/workcell'
import { useViewValue } from '../shared/use-view-value'
import { useOriginalBinding, type BodySource } from './body-subscriptions'
import { VisualPlacementFields } from './visual-placement-fields'

interface Props {
  source: BodySource
  update: (patch: Partial<Body>) => void
}

function OriginalPart({
  source,
  update,
  id,
  index
}: Props & { id: string; index: number }) {
  const binding = useOriginalBinding(source, id)

  if (!binding) return null

  return (
    <fieldset aria-label={`Original part ${index + 1}`}>
      <legend>Part {index + 1}</legend>

      <p className="asset-digest col-span-full wrap-anywhere">
        SHA-256: {binding.assetId}
      </p>

      <VisualPlacementFields
        value={binding}
        onChange={(placement) =>
          update({
            visuals: source
              .getSnapshot()
              .visuals?.map((entry) =>
                entry.id === id ? { ...entry, ...placement } : entry
              )
          })
        }
      />

      <button
        type="button"
        onClick={() => {
          const bindings = source.getSnapshot().visuals

          update({
            ...(bindings?.length === 1 ? { colliders: [] } : {}),
            visuals: bindings?.filter((entry) => entry.id !== id)
          })
        }}
      >
        Remove original part {index + 1}
      </button>
    </fieldset>
  )
}

export function OriginalParts({ source, update }: Props) {
  const membership = useViewValue(source, (body) =>
    JSON.stringify(body.visuals?.map((binding) => binding.id) ?? [])
  )

  const ids = JSON.parse(membership) as string[]

  return (
    <details className="visual-bindings">
      <summary>
        Original parts <span>{ids.length}</span>
      </summary>

      <p className="hint text-[10px] leading-[1.6] text-sim-muted font-normal">
        Import a GLB in Experiments to attach a complete part. Placement affects
        both display and analysis. Each field edit is one Undo action.
      </p>

      {ids.map((id, index) => (
        <OriginalPart
          key={id}
          id={id}
          index={index}
          source={source}
          update={update}
        />
      ))}
    </details>
  )
}
