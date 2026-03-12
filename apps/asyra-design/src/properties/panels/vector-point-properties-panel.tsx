import Header from '../header'
import VectorPoint from '../vector-point'

const VectorPointPropertiesPanel = ({ title }: { title: string }) => (
  <div className="grid grid-cols-1 w-full">
    <Header label={title} />
    <VectorPoint />
  </div>
)

export default VectorPointPropertiesPanel
