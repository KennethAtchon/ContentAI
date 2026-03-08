import { getEnvVar } from "../config/envUtil";

const debugLog = Object.assign(
  (message: string, ...args: unknown[]) => {
    if (getEnvVar("NODE_ENV", false) === "development") {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  },
  {
    warn: (message: string, ...args: unknown[]) => {
      if (getEnvVar("NODE_ENV", false) === "development") {
        console.warn(`[DEBUG] ${message}`, ...args);
      }
    },
    error: (message: string, ...args: unknown[]) => {
      if (getEnvVar("NODE_ENV", false) === "development") {
        console.error(`[DEBUG] ${message}`, ...args);
      }
    },
    info: (message: string, ...args: unknown[]) => {
      if (getEnvVar("NODE_ENV", false) === "development") {
        console.info(`[DEBUG] ${message}`, ...args);
      }
    },
    debug: (message: string, ...args: unknown[]) => {
      if (getEnvVar("NODE_ENV", false) === "development") {
        console.debug(`[DEBUG] ${message}`, ...args);
      }
    },
  },
);

export default debugLog;
export { debugLog };
