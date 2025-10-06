const isDebugMode = import.meta.env.DEV;

/**
 * Logs messages to the console only in development mode.
 */
export const log = (...args: unknown[]): void => {
  if (isDebugMode) {
    console.log(...args);
  }
};

/**
 * Logs error messages to the console.
 */
export const logError = (...args: unknown[]): void => {
  console.error(...args);
};
