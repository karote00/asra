export interface FeatureSystemAPIs {
  initFeatureSystem: (packages: {
    inputSystem: any
    systemContext: any
    interactionCore: any
    core?: any
  }) => void
  setAppKeyCombinations: (combinations: any) => void
}
