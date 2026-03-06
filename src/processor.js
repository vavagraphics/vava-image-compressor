/**
 * VAVA Image Compressor — Core Processor
 * Pipeline: Load → Resize → WebP high-quality
 * Full version:  Landscape 1600px | Portrait/Square 1000px (longest side)
 * Small version: 600px longest side, suffix "-small"
 * Pure client-side, no APIs or dependencies required.
 */

const MAX_LANDSCAPE = 1600;
const MAX_PORTRAIT  = 1000;
const MAX_SMALL     = 600;
const WEBP_QUALITY  = 0.85;

/** Pick full-size limit based on orientation. */
function maxSideFor(w, h) {
  return w > h ? MAX_LANDSCAPE : MAX_PORTRAIT;
}

/**
 * Process a file into both versions.
 * Returns { full, small, originalSize, originalWidth, originalHeight }
 */
function processImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to decode image — unsupported format?'));
      img.onload = async () => {
        const ow = img.naturalWidth;
        const oh = img.naturalHeight;

        try {
          const dimFull  = calcDimensions(ow, oh, maxSideFor(ow, oh));
          const dimSmall = calcDimensions(ow, oh, MAX_SMALL);

          const [blobFull, blobSmall] = await Promise.all([
            drawAndExport(img, dimFull.width, dimFull.height),
            drawAndExport(img, dimSmall.width, dimSmall.height),
          ]);

          resolve({
            originalSize: file.size,
            originalWidth: ow,
            originalHeight: oh,
            full: {
              blob: blobFull,
              width: dimFull.width,
              height: dimFull.height,
              size: blobFull.size,
            },
            small: {
              blob: blobSmall,
              width: dimSmall.width,
              height: dimSmall.height,
              size: blobSmall.size,
            },
          });
        } catch (err) {
          reject(err);
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/** Draw image to canvas at given size and export as WebP blob. */
function drawAndExport(img, width, height) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('WebP export failed')),
      'image/webp',
      WEBP_QUALITY
    );
  });
}

/**
 * Calculate target dimensions keeping aspect ratio.
 * Longest side becomes maxSide. Never upscales.
 */
function calcDimensions(w, h, maxSide) {
  if (w <= maxSide && h <= maxSide) return { width: w, height: h };
  if (w >= h) return { width: maxSide, height: Math.round(h * (maxSide / w)) };
  return { width: Math.round(w * (maxSide / h)), height: maxSide };
}

/** Format bytes to human-readable string. */
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

/** Output filename for the full version. */
function outputName(originalName) {
  const base = originalName.replace(/\.[^.]+$/, '');
  return base + '-compressed.webp';
}

/** Output filename for the small version. */
function outputNameSmall(originalName) {
  const base = originalName.replace(/\.[^.]+$/, '');
  return base + '-compressed-small.webp';
}

/** Create a timestamped folder name. */
function sessionFolderName() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  return `web-compressions-${date}_${time}`;
}

/** Trigger a single blob download. */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
