import { defineConfig } from "vite";
import electron from "vite-plugin-electron";

/**
 * Vite configuration for Electron with dual-process support.
 *
 * - Main process (main.ts): Bundled as CommonJS for Node.js → dist-electron/
 * - Preload script (preload.ts): Bundled for isolated context bridge → dist-electron/
 * - Renderer process: Served via Vite dev server with HMR (index.html is the entry)
 */
export default defineConfig({
  // Build renderer assets to dist/ for production
  build: {
    outDir: "dist",
  },
  plugins: [
    /**
     * Electron plugin: bundles main/preload processes and launches Electron.
     * In dev mode, starts Vite dev server for the renderer and injects
     * VITE_DEV_SERVER_URL into the main process environment.
     */
    electron({
      /** Main process entry - Node.js target */
      main: {
        entry: "src/main.ts",
        vite: {
          build: {
            outDir: "dist-electron",
          },
        },
      },
      /** Preload script entry */
      preload: {
        input: "src/preload.ts",
        vite: {
          build: {
            outDir: "dist-electron",
          },
        },
      },
    }),
  ],
});
