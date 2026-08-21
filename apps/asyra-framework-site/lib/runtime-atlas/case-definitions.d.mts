export interface AtlasActionDefinition {
  readonly id: string
  readonly label: string
  readonly owner: string
  readonly description: string
}

export interface AtlasCaseDefinition {
  readonly id: string
  readonly eyebrow: string
  readonly title: string
  readonly purpose: string
  readonly expectedResult: string
  readonly guideIds: readonly string[]
  readonly packages: readonly string[]
  readonly actions: readonly AtlasActionDefinition[]
}

export const ATLAS_CASES: readonly AtlasCaseDefinition[]
export const ATLAS_CASE_IDS: readonly string[]
export function getAtlasCase(caseId: string): AtlasCaseDefinition | undefined
