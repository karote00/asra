import Header from '../header'
import Position from '../position'
import Dimension from '../dimension'
import Rotation from '../rotation'
import Fills from '../fills'
import { useElementSelection } from '../../providers'

const ElementPropertiesPanel = () => {
  const elementSelection = useElementSelection()

  if (!elementSelection.size) {
    return null
  }

  return (
    <>
      <Header label="Layout" />
      <Position />
      <Dimension />
      <Rotation />
      <>
        <Header label="Appearance" />
        <Fills />
      </>
    </>
  )
}

export default ElementPropertiesPanel
