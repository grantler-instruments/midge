import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// GitHub Pages project site: https://grantler-instruments.github.io/midge/
const base = process.env.VITE_BASE ?? "/midge/";

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    port: 5175,
    strictPort: true,
  },
});
