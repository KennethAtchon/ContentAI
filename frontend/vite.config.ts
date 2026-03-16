import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-vite-plugin";
import path from "path";

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
    port: 3000,
    // Allow Docker service hostnames (e.g. "frontend") used by the e2e container
    allowedHosts: ["frontend", "localhost"],
    proxy: {
      "/api": {
        target: process.env.VITE_API_URL || "http://localhost:3002",
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
