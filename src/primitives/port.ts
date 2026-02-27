/**
 * getPort - Read PORT environment variable with validation
 *
 * Default: 3000
 * Throws: if PORT is set but not a valid positive integer
 */
export function getPort(): number {
  const portEnv = process.env.PORT;

  if (portEnv === undefined) {
    return 3000;
  }

  const port = Number.parseInt(portEnv, 10);

  if (Number.isNaN(port) || port <= 0 || port > 65535) {
    throw new Error(
      `Invalid PORT: "${portEnv}". Must be a number between 1 and 65535.`,
    );
  }

  return port;
}
