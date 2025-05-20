import { PrimaryToolAPIs } from './primary-tool'
import { MouseStateAPIs } from './mouse-state'

export { PrimaryToolAPIs, MouseStateAPIs }

export type SystemContextAPIs = PrimaryToolAPIs & MouseStateAPIs

export * from './deps'
