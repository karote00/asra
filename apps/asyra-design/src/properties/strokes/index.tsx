import { MIXED_STRING } from '@asyra/utils'
import { useStrokes } from '../../providers'
import { useProperty } from '../../hooks'
import { strokeApis } from '../../common-apis'
import StrokeList from './list'

const Strokes = () => {
  const strokesValue = useStrokes()
  const selection = useProperty<Set<string>>('elementSelection')
  const ownerElementId = selection.size === 1 ? Array.from(selection)[0] : null
  const mixed = strokesValue === MIXED_STRING
  const strokes = mixed ? [] : strokesValue

  const handleAddStroke = () => {
    if (ownerElementId) {
      strokeApis.addStroke(ownerElementId)
    }
  }

  const handleRemoveStroke = (index: number) => {
    if (index < 0 || index >= strokes.length) {
      return
    }

    const strokeId = strokes[index]?.ids[0]
    if (ownerElementId && strokeId) {
      strokeApis.removeStroke(ownerElementId, strokeId)
    }
  }

  return (
    <StrokeList
      strokes={strokes}
      ownerElementId={ownerElementId}
      mixed={mixed}
      onAdd={handleAddStroke}
      onRemoveStroke={handleRemoveStroke}
    />
  )
}

export default Strokes
