declare module '*.svg?react' {
  import React from 'react'
  const ReactComponent: React.FC<React.SVGProps<SVGElement>>
  export default ReactComponent
}
