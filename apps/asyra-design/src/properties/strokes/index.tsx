import { MIXED_STRING, createDefaultStroke } from '@asyra/utils'
import { useStrokes } from '../../providers'
import { useProperty } from '../../hooks'
import { updateSelectedElementProperties } from '../../controllers/scene-tree'
import StrokeList from './list'

const Strokes = () => {
  const strokesValue = useStrokes()
  const selection = useProperty<Set<string>>('elementSelection')
  const ownerElementId = selection.size === 1 ? Array.from(selection)[0] : null
  const mixed = strokesValue === MIXED_STRING
  const strokes = mixed ? [] : strokesValue

  const writeStrokes = (
    nextStrokes: (string | ReturnType<typeof createDefaultStroke>)[]
  ) => {
    updateSelectedElementProperties('strokes', nextStrokes)
  }

  const handleAddStroke = () => {
    const nextStrokes = [
      ...strokes.map((stroke) => stroke.ids[0]),
      createDefaultStroke()
    ]
    writeStrokes(nextStrokes)
  }

  const handleRemoveStroke = (index: number) => {
    if (index < 0 || index >= strokes.length) {
      return
    }

    const nextStrokes = strokes
      .filter((_, currentIndex) => currentIndex !== index)
      .map((stroke) => stroke.ids[0])

    writeStrokes(nextStrokes)
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
