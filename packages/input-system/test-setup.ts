Object.defineProperty(globalThis, 'navigator', {
  value: {
    userAgent: 'node.js'
  },
  writable: true
})
