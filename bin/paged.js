#!/usr/bin/env node

const { execSync, spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const target = process.argv[2];

if (!target) {
  console.log("Usage: paged <path>");
  console.log("  Opens a file or folder in Paged Editor.");
  console.log("");
  console.log("Examples:");
  console.log("  paged .                    # open current directory");
  console.log("  paged ~/projects/my-doc    # open a folder");
  console.log("  paged ./readme.md          # open a single file");
  process.exit(0);
}

const resolved = path.resolve(target);

// Find the app root (where main.js lives) by walking up from this script
const appRoot = path.resolve(__dirname, "..");
const mainJs = path.join(appRoot, "main.js");

if (fs.existsSync(mainJs)) {
  // Dev mode: launch Electron directly with the path as an argument
  const electronPath = path.join(appRoot, "node_modules", ".bin", "electron");
  const child = spawn(electronPath, [appRoot, resolved], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
} else {
  // Packaged app: use the paged:// protocol
  const url = `paged:///${resolved}`;
  if (process.platform === "darwin") {
    execSync(`open "${url}"`);
  } else if (process.platform === "linux") {
    execSync(`xdg-open "${url}"`);
  } else {
    execSync(`start "" "${url}"`);
  }
}
