/**
 * Pre-extracts winCodeSign with symlinks skipped (-snl) so electron-builder
 * can build NSIS installers on Windows without Developer Mode or admin rights.
 * Run automatically as `prebuild:installer` via npm scripts.
 */
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const https = require('https');

const VERSION    = '2.6.0';
const URL        = `https://github.com/electron-userland/electron-builder-binaries/releases/download/winCodeSign-${VERSION}/winCodeSign-${VERSION}.7z`;
const CACHE_BASE = path.join(process.env.LOCALAPPDATA, 'electron-builder', 'Cache', 'winCodeSign');
const EXTRACT_TO = path.join(CACHE_BASE, `winCodeSign-${VERSION}`);
const ZIP_PATH   = path.join(CACHE_BASE, `winCodeSign-${VERSION}.7z`);
const SEVEN_ZA   = path.join(__dirname, '..', 'node_modules', '7zip-bin', 'win', 'x64', '7za.exe');

function alreadyExtracted() {
  if (!fs.existsSync(EXTRACT_TO)) return false;
  const entries = fs.readdirSync(EXTRACT_TO);
  return entries.length > 2; // more than a couple files = extracted
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const follow = (u) => {
      https.get(u, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return follow(res.headers.location);
        }
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
      }).on('error', reject);
    };
    follow(url);
  });
}

async function main() {
  if (alreadyExtracted()) {
    console.log('[winCodeSign] Cache already present, skipping.');
    return;
  }

  fs.mkdirSync(CACHE_BASE, { recursive: true });
  fs.mkdirSync(EXTRACT_TO, { recursive: true });

  if (!fs.existsSync(ZIP_PATH)) {
    process.stdout.write('[winCodeSign] Downloading... ');
    await download(URL, ZIP_PATH);
    console.log('done.');
  }

  process.stdout.write('[winCodeSign] Extracting (symlinks skipped)... ');
  const result = spawnSync(SEVEN_ZA, ['x', '-bd', '-snl', '-y', ZIP_PATH, `-o${EXTRACT_TO}`], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    // Non-zero but symlink-only errors are acceptable — check if useful files exist
    const entries = fs.readdirSync(EXTRACT_TO);
    if (entries.length === 0) {
      console.error('\n[winCodeSign] Extraction failed completely.');
      console.error(result.stderr?.toString());
      process.exit(1);
    }
  }

  console.log('done.');
  console.log('[winCodeSign] Ready.');
}

main().catch(err => { console.error(err); process.exit(1); });
