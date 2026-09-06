import type { MethodDescriptor } from '../../analysis/contracts'
import type { ExperimentDraft } from '../../common-apis/experiment'
import type { Workcell } from '../../domain/workcell'
import { ViewSource } from '../shared/view-source'
import { scopeWithBodyRole } from './scope-draft'

export interface ExperimentFieldInputs {
  draft: ExperimentDraft
  workcell: Workcell
  methods: readonly MethodDescriptor[]
  exclusions: string
  onChange: (draft: ExperimentDraft) => void
  onExclusions: (value: string) => void
}

export interface ScopeSnapshot {
  scope: ExperimentDraft['scope']
  ids: readonly string[]
  names: ReadonlyMap<string, string>
  roles: ReadonlyMap<string, string>
  exclusions: string
}

/** Transient field projections, not an editable canonical model. */
export class ExperimentFieldsView extends ViewSource<ExperimentFieldInputs> {
  readonly scope: ViewSource<ScopeSnapshot>

  constructor(initial: ExperimentFieldInputs) {
    super(initial)

    this.scope = new ViewSource(this.scopeSnapshot(initial))
  }

  private scopeSnapshot(next: ExperimentFieldInputs): ScopeSnapshot {
    const previous = this.scope?.getSnapshot()

    const sameWorkcell =
      previous && this.getSnapshot().workcell === next.workcell

    const sameScope = previous?.scope === next.draft.scope

    return {
      scope: next.draft.scope,
      ids: sameWorkcell
        ? previous.ids
        : next.workcell.bodies.map((body) => body.id),
      names: sameWorkcell
        ? previous.names
        : new Map(next.workcell.bodies.map((body) => [body.id, body.name])),
      roles: sameScope
        ? previous.roles
        : new Map([
            ...next.draft.scope.influencingBodyIds.map(
              (id) => [id, 'influencing'] as const
            ),
            ...next.draft.scope.primaryBodyIds.map(
              (id) => [id, 'primary'] as const
            )
          ]),
      exclusions: next.exclusions
    }
  }

  override publish(next: ExperimentFieldInputs): void {
    const previous = this.getSnapshot()

    const scopeChanged =
      previous.draft.scope !== next.draft.scope ||
      previous.workcell !== next.workcell ||
      previous.exclusions !== next.exclusions

    const scope = scopeChanged
      ? this.scope.stage(this.scopeSnapshot(next))
      : undefined

    const fields = this.stage(next)

    scope?.()

    fields()
  }

  changeScope = (patch: Partial<ExperimentDraft['scope']>) => {
    const current = this.getSnapshot()

    current.onChange({
      ...current.draft,
      scope: { ...current.draft.scope, ...patch }
    })
  }

  changeDraft = (change: (draft: ExperimentDraft) => ExperimentDraft) => {
    const current = this.getSnapshot()

    current.onChange(change(current.draft))
  }

  changeRole = (id: string, role: string) => {
    const current = this.getSnapshot()

    current.onChange({
      ...current.draft,
      scope: scopeWithBodyRole(current.draft.scope, id, role)
    })
  }

  changeExclusions = (text: string) => this.getSnapshot().onExclusions(text)
}
