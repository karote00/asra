import render, { Render } from './render'
import { initDataContexts } from './subscribes'
console.error('initDataContexts')
initDataContexts()

export default render
export { Render }
