import Header from '../header'
import Position from '../position'
import Dimension from '../dimension'
import Rotation from '../rotation'
import Fills from '../fills'
import Strokes from '../strokes'
import { useElementSelection } from '../../providers'

const SectionDivider = () => <div className="h-[1px] bg-white/5 my-1" />

const ElementPropertiesPanel = ({ title }: { title: string }) => {
  const elementSelection = useElementSelection()

  if (!elementSelection.size) {
    return null
  }

  return (
    <div className="flex flex-col">
      {/* Design section: Position, Dimension, Rotation */}
      <Header label={title} />
      <div className="grid grid-cols-1 w-full pb-2">
        <Position />
        <Dimension />
        <Rotation />
      </div>

      <SectionDivider />

      {/* Fill section */}
      <Fills />

      <SectionDivider />

      {/* Stroke section */}
      <Strokes />
    </div>
  )
}

export default ElementPropertiesPanel
