let defaultExactGeometryBackendPromise: Promise<void> | null = null

export const enableDefaultExactGeometryBackend = (): Promise<void> => {
  if (!defaultExactGeometryBackendPromise) {
    defaultExactGeometryBackendPromise = import(
      './components/stroke-render/clipper2-geometry-backend'
    )
      .then(({ loadAndRegisterClipper2GeometryBackend }) =>
        loadAndRegisterClipper2GeometryBackend({ select: true })
      )
      .then(() => undefined)
      .catch((error) => {
        defaultExactGeometryBackendPromise = null
        throw error
      })
  }

  return defaultExactGeometryBackendPromise
}
