import inputSystem from '@asyra/input-system'
import { keyCombinations } from '../../config/key-combinations'

export const initInputSystem = () => {
  inputSystem.registry.registerKeyCombinations(keyCombinations)
}
