import factory from './factory'
import { initFactorySubscribe } from './subscribes'

initFactorySubscribe()

export default factory
export {
  default as DataTransact,
  dataTransact,
  ChangeDataType
} from './data-transact'
