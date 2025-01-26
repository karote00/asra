import factory from './factory'
import { initFactorySubscribe } from './subscribes'

initFactorySubscribe()

export default factory
export { default as DataTransact, ChangeDataType } from './data-transact'
