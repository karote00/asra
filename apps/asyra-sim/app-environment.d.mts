export function resolveAppEnvironment(
  environment?: Record<string, string | undefined>
): Readonly<{ url: string; host: string; port: number }>
