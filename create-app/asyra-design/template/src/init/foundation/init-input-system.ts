import { keyCombinations } from '../../config/key-combinations'
import core from '../../contexts'

export const initInputSystem = () => {
  return core.registerInputKeyCombinations(keyCombinations)
}
