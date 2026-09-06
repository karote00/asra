import { memo } from 'react'
import type { Body } from '../../domain/workcell'
import { equalBindings } from './equal-fields'
import { VisualPlacementFields } from './visual-placement-fields'

export const OriginalParts = memo(
  function OriginalParts({
    bindings,
    update
  }: {
    bindings: Body['visuals']
    update: (patch: Partial<Body>) => void
  }) {
    return (
      <details className="visual-bindings">
        <summary>
          Original parts <span>{bindings?.length ?? 0}</span>
        </summary>

        <p className="hint text-[10px] leading-[1.6] text-sim-muted font-normal">
          Import a GLB in Experiments to attach a complete part. Placement
          affects both display and analysis. Each field edit is one Undo action.
        </p>

        {(bindings ?? []).map((binding, index) => (
          <fieldset key={binding.id} aria-label={`Original part ${index + 1}`}>
            <legend>Part {index + 1}</legend>

            <p className="asset-digest col-span-full wrap-anywhere">
              SHA-256: {binding.assetId}
            </p>

            <VisualPlacementFields
              value={binding}
              onChange={(placement) =>
                update({
                  visuals: bindings?.map((entry) =>
                    entry.id === binding.id ? { ...entry, ...placement } : entry
                  )
                })
              }
            />

            <button
              type="button"
              onClick={() =>
                update({
                  ...(bindings?.length === 1 ? { colliders: [] } : {}),
                  visuals: bindings?.filter((entry) => entry.id !== binding.id)
                })
              }
            >
              Remove original part {index + 1}
            </button>
          </fieldset>
        ))}
      </details>
    )
  },
  (a, b) => equalBindings(a.bindings, b.bindings) && a.update === b.update
)
