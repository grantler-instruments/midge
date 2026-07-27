import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const site = join(root, "site");
const websiteDist = join(root, "website", "dist");

rmSync(site, { recursive: true, force: true });
mkdirSync(site, { recursive: true });

cpSync(websiteDist, site, { recursive: true });

console.log("Assembled GitHub Pages site: marketing → site/");
