import { createSyntheticExample } from '../../../samples/synthetic-workcell'
import { createSyntheticExperimentDraft } from '../../../samples/synthetic-experiment'
import { createExperimentSnapshot } from '../../analysis/snapshot'
import { terminalAnalysisResult } from '../../analysis/result'
import { OFFICIAL_CLEARANCE_METHOD } from '../../analysis/methods/official-method'
import { ComponentTypes, PropertyFields, PropertyNames } from '../../constants'
import type { FieldObservation } from '../../common-apis/observation-contract'
import type { ObservationSourceRecord } from '../observation-source'

export function observationProject(
  observations: readonly FieldObservation[],
  sources: readonly ObservationSourceRecord[]
) {
  const example = createSyntheticExample(),
    draft = createSyntheticExperimentDraft(example)
  const snapshot = createExperimentSnapshot({
    snapshotId: 'snapshot',
    candidateId: 'candidate',
    experimentId: 'study',
    workcell: example.workcell,
    definition: { ...draft, revision: 1, rule: { ...draft.rule, revision: 1 } },
    methods: [OFFICIAL_CLEARANCE_METHOD],
    acknowledgedWarningCodes: []
  })
  return {
    document: {
      version: '1.0.0',
      sceneTree: {
        workspace: '',
        workspaceList: [],
        elements: {
          candidate: { id: 'candidate', type: ComponentTypes.CANDIDATE },
          retained: {
            id: 'retained',
            type: ComponentTypes.RUN_REFERENCE,
            parentId: 'candidate',
            name: 'Study',
            props: { [PropertyNames.RUN_REFERENCE]: 'retained-props' }
          }
        }
      },
      props: {
        'retained-props': {
          [PropertyFields.RUN_REFERENCE]: {
            version: 1,
            runId: 'run',
            snapshotId: 'snapshot',
            experimentId: 'study',
            observations
          }
        }
      }
    },
    loadIssues: [],
    observationSources: sources,
    runs: [
      {
        version: 1 as const,
        name: 'Study',
        retainedAt: '2026-09-05T00:00:00.000Z',
        environment: {
          appVersion: 'test',
          userAgent: 'unit test',
          hardwareConcurrency: 1
        },
        snapshot,
        result: terminalAnalysisResult(snapshot, [], {
          runId: 'run',
          startedAt: 0,
          endedAt: 1,
          execution: 'cancelled',
          error: 'Cancelled'
        })
      }
    ]
  }
}
