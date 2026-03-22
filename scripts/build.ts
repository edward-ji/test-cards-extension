import fs from 'fs';
import path from 'path';
import esbuild from 'esbuild';
import { fileURLToPath } from 'url';

/**
 * Build script: copies shared extension files into dist/chrome and dist/firefox,
 * then writes the correct manifest and background script for each browser.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');

const SHARED_FILES = [
  'panel.html',
  'panel.css',
];
const SHARED_DIRS = ['data', 'images', 'fonts'];

function copyFile(src: string, dest: string) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDir(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  if (fs.cpSync) {
    fs.cpSync(src, dest, { recursive: true });
  } else {
    copyDirRecursive(src, dest);
  }
}

function copyDirRecursive(src: string, dest: string) {
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

function buildBrowser(browser: 'chrome' | 'firefox') {
  const outDir = path.join(DIST, browser);
  fs.mkdirSync(outDir, { recursive: true });

  for (const file of SHARED_FILES) {
    copyFile(path.join(SRC, file), path.join(outDir, file));
  }
  for (const dir of SHARED_DIRS) {
    const src = path.join(SRC, dir);
    if (fs.existsSync(src)) {
      copyDir(src, path.join(outDir, dir));
    }
  }

  // Bundle TypeScript via ESBuild into the output directory
  esbuild.buildSync({
    entryPoints: [path.join(SRC, 'panel.ts')],
    bundle: true,
    outfile: path.join(outDir, 'panel.js'),
    target: ['es2020'],
    minify: process.env.NODE_ENV === 'production'
  });

  const manifestSrc = path.join(SRC, 'manifests', `${browser}.json`);
  const manifestDest = path.join(outDir, 'manifest.json');
  fs.copyFileSync(manifestSrc, manifestDest);

  // Bundle Background Script via ESBuild
  if (browser === 'chrome') {
    esbuild.buildSync({
      entryPoints: [path.join(SRC, 'background-chrome.ts')],
      bundle: true,
      outfile: path.join(outDir, 'service-worker.js'),
      target: ['es2020'],
      minify: process.env.NODE_ENV === 'production'
    });
  } else if (browser === 'firefox') {
    esbuild.buildSync({
      entryPoints: [path.join(SRC, 'background-firefox.ts')],
      bundle: true,
      outfile: path.join(outDir, 'background-firefox.js'),
      target: ['es2020'],
      minify: process.env.NODE_ENV === 'production'
    });
  }

  console.log(`Built ${browser} -> ${outDir}`);
}

function main() {
  const targets = process.argv.slice(2);
  const browsers = targets.length ? targets : ['chrome', 'firefox'];

  for (const browser of browsers) {
    if (browser !== 'chrome' && browser !== 'firefox') {
      console.error(`Unknown target: ${browser}`);
      process.exit(1);
    }
    buildBrowser(browser as 'chrome' | 'firefox');
  }
}

main();
