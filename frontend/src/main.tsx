import { scan } from "react-scan";
if (import.meta.env.DEV) {
  scan({ enabled: true });
}

import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { RouterProvider } from "@tanstack/react-router";
import { I18nextProvider } from "react-i18next";
import { router } from "./router";
import { appQueryClient } from "./app-query-client";
import i18n from "@/app/i18n/i18n";
import { AppProvider } from "@/app/state/app-context";

// Initialize Sentry for error tracking
import { initializeSentry } from "@/shared/observability/sentry";
initializeSentry();

import "./styles/globals.css";
import "./styles/light-theme.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/lora/400.css";
import "@fontsource/lora/500.css";
import "@fontsource/lora/600.css";
import "@fontsource/lora/700.css";

const rootElement = document.getElementById("root")!;
const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <I18nextProvider i18n={i18n}>
      <HelmetProvider>
        <QueryClientProvider client={appQueryClient}>
          <AppProvider>
            <RouterProvider
              router={router}
              context={{ queryClient: appQueryClient }}
            />
          </AppProvider>
        </QueryClientProvider>
      </HelmetProvider>
    </I18nextProvider>
  </React.StrictMode>
);
