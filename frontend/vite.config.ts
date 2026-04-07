import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-vite-plugin";
import path from "path";

const usePolling = ["1", "true", "yes"].includes(
  (process.env.VITE_USE_POLLING ?? "false").toLowerCase()
);
const pollingInterval = Number(process.env.VITE_POLLING_INTERVAL ?? "300");
const devProxyTarget = process.env.VITE_DEV_PROXY_TARGET ?? "http://localhost:3001";
const devHost = process.env.VITE_DEV_HOST ?? "localhost";

export default defineConfig({
  logLevel: "error",
  plugins: [react(), TanStackRouterVite()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@/shared": path.resolve(__dirname, "./src/shared"),
      "@/features": path.resolve(__dirname, "./src/features"),
    },
  },
  server: {
    host: devHost,
    port: 3000,
    strictPort: true,
    // Allow Docker service hostnames (e.g. "frontend") used by the e2e container.
    allowedHosts: ["frontend", "localhost", "127.0.0.1"],
    watch: usePolling
      ? {
          usePolling: true,
          interval: pollingInterval,
        }
      : undefined,
    proxy: {
      "/api": {
        // Browser base URL is separate (`VITE_API_URL` in envUtil).
        target: devProxyTarget,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
          query: ["@tanstack/react-query"],
        },
      },
    },
  },
  preview: {
    port: 4173,
    host: true,
  },
});
