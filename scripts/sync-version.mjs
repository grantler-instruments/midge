import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function readVersion() {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  return pkg.version;
}

function normalizeVersion(raw) {
  const version = raw.replace(/^v/, "");
  if (!/^\d+\.\d+\.\d+/.test(version)) {
    throw new Error(`Invalid version: ${raw}`);
  }
  return version;
}

function setPackageJson(path, version) {
  const pkg = JSON.parse(readFileSync(path, "utf8"));
  if (pkg.version === version) return;
  pkg.version = version;
  writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`);
}

function setCargoToml(version) {
  const path = join(root, "src-tauri", "Cargo.toml");
  const contents = readFileSync(path, "utf8");
  const match = contents.match(/^version = "(.*)"\r?$/m);
  if (!match) {
    throw new Error("Could not find version in Cargo.toml");
  }
  if (match[1] === version) return;
  writeFileSync(path, contents.replace(/^version = ".*"\r?$/m, `version = "${version}"`));
}

function setCargoLock(version) {
  const path = join(root, "src-tauri", "Cargo.lock");
  const contents = readFileSync(path, "utf8");
  const match = contents.match(/^name = "midge"\r?\nversion = "(.*)"\r?$/m);
  if (!match) {
    throw new Error('Could not find "midge" package version in Cargo.lock');
  }
  if (match[1] === version) return;
  const eol = contents.includes("\r\n") ? "\r\n" : "\n";
  writeFileSync(
    path,
    contents.replace(
      /^name = "midge"\r?\nversion = ".*"\r?$/m,
      `name = "midge"${eol}version = "${version}"`,
    ),
  );
}

// tauri.conf.json intentionally not updated: it uses "version": "../package.json",
// so the bundle version tracks the root package.json automatically.
const version = normalizeVersion(process.argv[2] ?? readVersion());
setPackageJson(join(root, "package.json"), version);
setPackageJson(join(root, "website", "package.json"), version);
setCargoToml(version);
setCargoLock(version);
console.log(`Synced version to ${version}`);
