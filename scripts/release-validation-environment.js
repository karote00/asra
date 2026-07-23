export const createReleaseValidationEnvironment = ({
  appPort,
  collaborationPort,
  environment = process.env
}) => ({
  ...environment,
  ASYRA_DESIGN_APP_URL: `http://127.0.0.1:${appPort}`,
  ASYRA_DESIGN_COLLABORATION_WS_PORT: `${collaborationPort}`,
  VITE_ASYRA_DESIGN_COLLABORATION_WS_URL: `ws://127.0.0.1:${collaborationPort}/asyra-design-collaboration`
})
