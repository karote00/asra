import type { CorePackages } from '@asyra/feature-system'

export interface FeatureSystemAPIs {
  initFeatureSystem: (packages: CorePackages) => void
}
