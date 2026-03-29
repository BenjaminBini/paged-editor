#!/usr/bin/env node

const { execSync } = require("child_process");
const path = require("path");

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
const url = `paged:///${resolved}`;

if (process.platform === "darwin") {
  execSync(`open "${url}"`);
} else if (process.platform === "linux") {
  execSync(`xdg-open "${url}"`);
} else {
  // Windows
  execSync(`start "" "${url}"`);
}
