/**
 * Zips the dist folder into a single distributable file.
 * Run: npm run zip
 * Output: dist/VAVA-Image-Compressor-win32-x64.zip
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const distDir = path.join(__dirname, '..', 'dist');
const appFolder = 'VAVA Image Compressor-win32-x64';
const zipName = 'VAVA-Image-Compressor-win32-x64.zip';
const zipPath = path.join(distDir, zipName);
const appPath = path.join(distDir, appFolder);

if (!fs.existsSync(appPath)) {
  console.error('Build folder not found. Run `npm run build` first.');
  process.exit(1);
}

// Remove old zip if exists
if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

console.log('Zipping...');
// Use PowerShell's Compress-Archive (available on all Windows 10+)
execSync(
  `powershell -Command "Compress-Archive -Path '${appPath}\\*' -DestinationPath '${zipPath}' -Force"`,
  { stdio: 'inherit' }
);

const size = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(1);
console.log(`Done: dist/${zipName} (${size} MB)`);
console.log('Send this ZIP to clients. They extract it and run "VAVA Image Compressor.exe".');
