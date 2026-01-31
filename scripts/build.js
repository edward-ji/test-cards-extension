#!/usr/bin/env node
/**
 * Build script: copies shared extension files into dist/chrome and dist/firefox,
 * then writes the correct manifest and background script for each browser.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");

const SHARED_FILES = [
  "panel.html",
  "panel.js",
  "panel.css",
];
const SHARED_DIRS = ["data", "images", "third-party"];

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  if (fs.cpSync) {
    fs.cpSync(src, dest, { recursive: true });
  } else {
    copyDirRecursive(src, dest);
  }
}

function copyDirRecursive(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function buildBrowser(browser) {
  const outDir = path.join(DIST, browser);
  fs.mkdirSync(outDir, { recursive: true });

  for (const file of SHARED_FILES) {
    copyFile(path.join(ROOT, file), path.join(outDir, file));
  }
  for (const dir of SHARED_DIRS) {
    const src = path.join(ROOT, dir);
    if (fs.existsSync(src)) {
      copyDir(src, path.join(outDir, dir));
    }
  }

  const manifestSrc = path.join(ROOT, "manifests", `${browser}.json`);
  const manifestDest = path.join(outDir, "manifest.json");
  fs.copyFileSync(manifestSrc, manifestDest);

  if (browser === "chrome") {
    copyFile(
      path.join(ROOT, "service-worker.js"),
      path.join(outDir, "service-worker.js")
    );
  } else if (browser === "firefox") {
    copyFile(
      path.join(ROOT, "background-firefox.js"),
      path.join(outDir, "background-firefox.js")
    );
  }

  console.log(`Built ${browser} -> ${outDir}`);
}

function main() {
  const targets = process.argv.slice(2);
  const browsers = targets.length ? targets : ["chrome", "firefox"];

  for (const browser of browsers) {
    if (browser !== "chrome" && browser !== "firefox") {
      console.error(`Unknown target: ${browser}`);
      process.exit(1);
    }
    buildBrowser(browser);
  }
}

main();
