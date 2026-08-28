const liveEndpointKeys = new Set([
  'APP_URL',
  'COLLABORATION_WS_PORT',
  'VITE_COLLABORATION_WS_URL'
])

export const createReleaseValidationBaseEnvironment = ({
  environment = process.env
} = {}) => {
  return Object.fromEntries(
    Object.entries(environment).filter(([key]) => !liveEndpointKeys.has(key))
  )
}

export const createReleaseValidationEnvironment = ({
  appPort,
  collaborationPort,
  environment = process.env
}) => ({
  ...createReleaseValidationBaseEnvironment({ environment }),
  APP_URL: `http://127.0.0.1:${appPort}`,
  COLLABORATION_WS_PORT: `${collaborationPort}`,
  VITE_COLLABORATION_WS_URL: `ws://127.0.0.1:${collaborationPort}/collaboration`
})
