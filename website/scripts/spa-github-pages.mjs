import { copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

// GitHub Pages serves 404.html for unknown paths; copy the SPA shell so
// /privacy and other client routes resolve on direct load.
copyFileSync(join(dist, "index.html"), join(dist, "404.html"));
console.log("Wrote dist/404.html for GitHub Pages SPA routing");
