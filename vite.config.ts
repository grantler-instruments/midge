import os from "node:os";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;
const isWindows = os.platform() === "win32";
const devHost = host ?? (isWindows ? "0.0.0.0" : true);

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
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
