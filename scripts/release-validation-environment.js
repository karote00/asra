export const createReleaseValidationEnvironment = ({
  appPort,
  collaborationPort,
  environment = process.env
}) => ({
  ...environment,
  APP_URL: `http://127.0.0.1:${appPort}`,
  COLLABORATION_WS_PORT: `${collaborationPort}`,
  VITE_COLLABORATION_WS_URL: `ws://127.0.0.1:${collaborationPort}/collaboration`
})
