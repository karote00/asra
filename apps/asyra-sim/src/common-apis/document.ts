import type { Core } from '@asyra/core'
import { PropertyFields, PropertyTypes } from '../constants'
import { validBodyProperty, validCandidateParameters } from '../init/properties'
import { validExperimentDefinition } from '../analysis/contracts'

export interface ModelLoadIssue {
  path: string
  message: string
}
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

/** Called inside the Feature interaction queue so async serialization cannot mix edits. */
export function captureCanonicalDocument(core: Core) {
  return core.save()
}

/** Core owns fallback/apply. The App retains analysis-critical source diagnostics. */
export function loadCanonicalDocument(
  core: Core,
  data: unknown
): readonly ModelLoadIssue[] {
  const issues: ModelLoadIssue[] = []
  if (record(data) && record(data.props))
    for (const [id, property] of Object.entries(data.props)) {
      if (!record(property)) continue
      if (
        property.type === PropertyTypes.BODY &&
        !validBodyProperty(property[PropertyFields.BODY])
      )
        issues.push({
          path: `props.${id}.${PropertyFields.BODY}`,
          message:
            'Analysis geometry or joint parameters required schema recovery; confirm or correct the repaired model before analysis.'
        })
      if (
        property.type === PropertyTypes.CANDIDATE &&
        !validCandidateParameters(property[PropertyFields.CANDIDATE])
      )
        issues.push({
          path: `props.${id}.${PropertyFields.CANDIDATE}`,
          message:
            'Candidate parameters required schema recovery; confirm or correct the repaired model before analysis.'
        })
      if (
        property.type === PropertyTypes.EXPERIMENT &&
        !validExperimentDefinition(property[PropertyFields.EXPERIMENT])
      )
        issues.push({
          path: `props.${id}.${PropertyFields.EXPERIMENT}`,
          message:
            'Experiment inputs required schema recovery; confirm or correct the definition before analysis.'
        })
    }
  const unsubscribe = core.registerLoadDiagnosticsHook((diagnostics) => {
    issues.push(
      ...diagnostics.map((item) => ({ path: item.path, message: item.message }))
    )
  })
  try {
    core.load(data)
  } finally {
    unsubscribe()
  }
  return Object.freeze(issues.map((issue) => Object.freeze(issue)))
}
