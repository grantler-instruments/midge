import os from "node:os";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;
const isWindows = os.platform() === "win32";
const devHost = host ?? (isWindows ? "0.0.0.0" : true);

// Base path — `/` for Tauri and dev; GitHub Pages web app overrides with
// VITE_BASE=/midge/app/.
// @ts-expect-error process is a nodejs global
const base = process.env.VITE_BASE ?? "/";

export default defineConfig({
  base,
  plugins: [react()],
  clearScreen: false,
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    pool: "forks",
    maxWorkers: "50%",
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.ts", "src/**/*.d.ts", "src/main.tsx"],
    },
  },
  server: {
    port: 1422,
    strictPort: true,
    host: devHost,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1423,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});
