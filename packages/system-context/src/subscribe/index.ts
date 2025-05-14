import { HandlerDeps } from '../types'
import { initPrimaryToolSubscribe } from './primary-tool'

export const initSystemContextSubscribe = (deps: HandlerDeps) => {
  initPrimaryToolSubscribe(deps.primaryToolState)
}
