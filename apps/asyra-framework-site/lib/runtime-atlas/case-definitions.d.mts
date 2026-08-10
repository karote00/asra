export interface AtlasActionDefinition {
  readonly id: string
  readonly label: string
  readonly owner: string
  readonly input: Readonly<Record<string, unknown>>
}

export interface AtlasCaseDefinition {
  readonly id: string
  readonly coordinate: string
  readonly title: string
  readonly plainLanguage: string
  readonly technicalSummary: string
  readonly expected: string
  readonly exampleIds: readonly string[]
  readonly owners: readonly string[]
  readonly conditions: readonly string[]
  readonly bypasses: readonly string[]
  readonly actions: readonly AtlasActionDefinition[]
}

export const ATLAS_CASES: readonly AtlasCaseDefinition[]
export const ATLAS_CASE_IDS: readonly string[]
export function getAtlasCase(caseId: string): AtlasCaseDefinition
