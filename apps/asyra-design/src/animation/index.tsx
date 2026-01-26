import React from 'react'
import Tree from './tree'
import Keyframes from './keyframes'
import Easing from './easing'

const Animation: React.FC = () => {
  return (
    <div className="flex z-10" style={{ gridArea: 'footer' }}>
      <Tree />
      <Keyframes />
      <Easing />
    </div>
  )
}

export default Animation
