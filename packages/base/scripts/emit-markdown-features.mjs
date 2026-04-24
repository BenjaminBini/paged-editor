#!/usr/bin/env node
// Emit `dist/markdown-features.json` — the machine-readable manifest of every
// custom markdown feature supported by the paged-editor renderer.
//
// Downstream consumers (e.g. the ao-analyst plugin) read this file instead of
// duplicating directive names inside their own documentation. Running this
// after every `tsc` build guarantees the manifest cannot drift from the code.
//
// Invoked from package.json `build` script — see scripts/... chain.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(__dirname, "..");
const registryEsm = resolve(
  packageRoot,
  "dist/js/document/rendering/container-registry.js",
);
const manifestPath = resolve(packageRoot, "dist/markdown-features.json");

const { CONTAINER_REGISTRY, MARKDOWN_FEATURES_SCHEMA_VERSION } = await import(
  pathToFileURL(registryEsm).href
);

const pkg = JSON.parse(
  readFileSync(resolve(packageRoot, "package.json"), "utf8"),
);

const manifest = {
  schemaVersion: MARKDOWN_FEATURES_SCHEMA_VERSION,
  generatedBy: `${pkg.name}@${pkg.version}`,
  generatedAt: new Date().toISOString(),
  features: CONTAINER_REGISTRY,
};

mkdirSync(dirname(manifestPath), { recursive: true });
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");

console.log(
  `  ✓ markdown-features.json (${CONTAINER_REGISTRY.length} features) → ${manifestPath}`,
);
