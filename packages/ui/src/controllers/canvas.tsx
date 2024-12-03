// import React, { useEffect, useRef } from 'react'
// import * as PIXI from 'pixi.js'
// import { canvasWidth, canvasHeight } from '../states/app'
// import { useSignal } from '@preact/signals-react'

// const UpdateCanvas: React.FC = () => {
//   const width = useSignal(canvasWidth)
//   const height = useSignal(canvasHeight)

//   const appRef = useRef<PIXI.Application | null>(null)

//   // 初始化 PixiJS 應用
//   useEffect(() => {
//     const app = new PIXI.Application({
//       width: width.value || window.innerWidth,
//       height: height.value || window.innerHeight,
//       backgroundColor: 0x1099bb
//     })

//     // 將 PixiJS 畫布加入 DOM
//     if (app.view) {
//       document.getElementById('pixi-container')?.appendChild(app.view)
//     }

//     appRef.current = app

//     // 清理工作
//     return () => {
//       appRef.current?.destroy(true, {
//         children: true,
//         texture: true,
//         baseTexture: true
//       })
//     }
//   }, [])

//   // 監聽 canvas 大小變化
//   useEffect(() => {
//     if (appRef.current && width.value && height.value) {
//       appRef.current.renderer.resize(width.value, height.value)
//     }
//   }, [width.value, height.value])

//   return (
//     <div>
//       <div id="pixi-container"></div>
//       <button
//         onClick={() => {
//           canvasWidth.value = window.innerWidth
//           canvasHeight.value = window.innerHeight
//         }}
//       >
//         Resize Canvas
//       </button>
//     </div>
//   )
// }

// export default UpdateCanvas
