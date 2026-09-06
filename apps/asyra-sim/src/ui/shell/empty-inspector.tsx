import type { RuntimeState } from '../../init/runtime-controller'

interface Props {
  lifecycle: RuntimeState
}

export function EmptyInspector({ lifecycle }: Props) {
  return (
    <div
      className="empty-inspector pt-[25px] px-[25px] pb-5 [&_h2]:text-[19px]
        [&_h2]:tracking-[-0.4px] [&_h2]:mb-[10px] [&_p]:text-[11px]
        [&_p]:leading-[1.9] [&_p]:text-sim-muted"
    >
      <span className="eyebrow text-[9px] tracking-[1.3px] text-sim-muted font-bold">
        INSPECTOR
      </span>

      <div className="empty-icon text-[56px] text-sim-muted mt-14 mx-0 mb-[18px] max-[700px]:hidden">
        ◇
      </div>

      <h2>
        {lifecycle.status === 'failed'
          ? 'Runtime unavailable.'
          : 'A closer look.'}
      </h2>

      <p>
        {lifecycle.status === 'failed'
          ? 'Download available recovery data before reloading. No model is currently editable.'
          : 'Select a body in the scene or hierarchy to edit its mounting, joints, and analysis shapes.'}
      </p>

      <div
        className="scope-note mt-[35px] pt-5 border-t border-t-sim-divider [&_strong]:block
          [&_strong]:text-[10px] [&_strong]:text-sim-secondary [&_strong]:mb-2"
      >
        <strong>Geometry, not guarantees.</strong>

        <p>
          This workbench executes experiments. Real equipment and safety
          decisions require independent validation.
        </p>
      </div>
    </div>
  )
}
