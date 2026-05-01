declare module 'clipper2-wasm' {
  const createClipper2Module: (options?: unknown) => Promise<unknown>

  export default createClipper2Module
}

declare module 'clipper2-wasm/dist/es/clipper2z.wasm?url' {
  const url: string
  export default url
}
