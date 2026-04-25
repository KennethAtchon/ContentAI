import * as Sentry from "@sentry/react";
import debug from "debug";

const log = debug("sentry:init");

export function initializeSentry() {
  // Only initialize Sentry if DSN is available
  const dsn = import.meta.env.VITE_SENTRY_DSN;

  if (!dsn || dsn === "your_sentry_dsn") {
    log("Sentry DSN not configured. Skipping Sentry initialization.");
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.NODE_ENV || "development",
    tracesSampleRate: import.meta.env.NODE_ENV === "production" ? 0.1 : 1.0,
    debug: import.meta.env.NODE_ENV === "development",

    // Release version for better error tracking
    release: import.meta.env.VITE_APP_VERSION || "1.0.0",

    // Integrations
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],

    // beforeSend filter to avoid sending sensitive data
    beforeSend(event) {
      // Filter out sensitive URLs or data if needed
      if (event.request?.url) {
        const url = event.request.url;
        if (url.includes("password") || url.includes("token")) {
          return null;
        }
      }
      return event;
    },
  });

  log("Sentry initialized successfully");
}

export const captureException = Sentry.captureException;
export const captureMessage = Sentry.captureMessage;
