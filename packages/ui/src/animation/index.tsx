import Tree from './tree'
import Keyframes from './keyframes'
import Easing from './easing'

const Animation = () => {
  return (
    <div className="bg-purple-500 flex " style={{ gridArea: 'footer' }}>
      <Tree />
      <Keyframes />
      <Easing />
    </div>
  )
}

export default Animation
