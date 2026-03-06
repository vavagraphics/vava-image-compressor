/**
 * VAVA Image Compressor — UI Logic
 */

// ─── State ────────────────────────────────────────────────────────────────────
const files = []; // { id, file, status, result, error }
let nextId = 0;

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const dropZone       = document.getElementById('dropZone');
const fileInput      = document.getElementById('fileInput');
const browseBtn      = document.getElementById('browseBtn');
const queueSection   = document.getElementById('queueSection');
const fileList       = document.getElementById('fileList');
const fileCountEl    = document.getElementById('fileCount');
const downloadZipBtn = document.getElementById('downloadZipBtn');
const clearBtn       = document.getElementById('clearBtn');
const statsBar       = document.getElementById('statsBar');

// ─── Drag & Drop ──────────────────────────────────────────────────────────────

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', (e) => {
  if (!dropZone.contains(e.relatedTarget)) dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const images = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/'));
  if (images.length) addFiles(images);
});

browseBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', () => {
  const images = [...fileInput.files].filter(f => f.type.startsWith('image/'));
  if (images.length) addFiles(images);
  fileInput.value = '';
});

// ─── File Processing ──────────────────────────────────────────────────────────

function addFiles(newFiles) {
  newFiles.forEach(file => {
    const id = nextId++;
    files.push({ id, file, status: 'pending', result: null, error: null });
    appendCard(id);
  });

  queueSection.classList.remove('hidden');
  updateUI();

  files
    .filter(f => f.status === 'pending')
    .forEach(f => runProcess(f.id));
}

async function runProcess(id) {
  const entry = files.find(f => f.id === id);
  if (!entry) return;

  entry.status = 'processing';
  refreshCard(id);

  try {
    entry.result = await processImage(entry.file);
    entry.status = 'done';
  } catch (err) {
    entry.error = err.message;
    entry.status = 'error';
  }

  refreshCard(id);
  updateUI();
}

// ─── Card Rendering ───────────────────────────────────────────────────────────

function appendCard(id) {
  const card = document.createElement('div');
  card.className = 'file-card';
  card.id = `card-${id}`;
  card.innerHTML = buildCardHTML(id);
  fileList.appendChild(card);
}

function refreshCard(id) {
  const card = document.getElementById(`card-${id}`);
  if (!card) return;
  card.innerHTML = buildCardHTML(id);

  const entry = files.find(f => f.id === id);
  if (entry?.status === 'done') drawThumbnail(id, entry.result.full.blob);
}

function buildCardHTML(id) {
  const entry = files.find(f => f.id === id);
  const name = entry.file.name;

  if (entry.status === 'pending' || entry.status === 'processing') {
    return `
      <div class="card-info">
        <div class="card-name">${esc(name)}</div>
        <div class="card-meta muted">${formatBytes(entry.file.size)}</div>
      </div>
      <div class="card-status">
        <div class="spinner"></div>
        <span class="muted">Processing…</span>
      </div>`;
  }

  if (entry.status === 'error') {
    return `
      <div class="card-info">
        <div class="card-name">${esc(name)}</div>
        <div class="card-meta error-text">${esc(entry.error)}</div>
      </div>
      <div class="card-status">
        <span class="badge badge-error">Error</span>
      </div>`;
  }

  const r = entry.result;
  const savingsFull  = Math.round((1 - r.full.size  / r.originalSize) * 100);
  const savingsSmall = Math.round((1 - r.small.size / r.originalSize) * 100);

  return `
    <div class="card-thumb-wrap">
      <canvas class="card-thumb" id="thumb-${id}" width="56" height="56"></canvas>
    </div>
    <div class="card-info">
      <div class="card-name">${esc(outputName(name))}</div>
      <div class="card-versions">
        <div class="card-version">
          <span class="version-label">Full</span>
          <span class="card-meta">
            ${r.full.width}&times;${r.full.height}
            &nbsp;&middot;&nbsp;
            ${formatBytes(r.originalSize)} &rarr; <strong>${formatBytes(r.full.size)}</strong>
            &nbsp;&middot;&nbsp;
            <span class="savings">&minus;${savingsFull}%</span>
          </span>
          <button class="btn-dl-version" data-id="${id}" data-version="full">Save</button>
        </div>
        <div class="card-version">
          <span class="version-label version-small">Small</span>
          <span class="card-meta">
            ${r.small.width}&times;${r.small.height}
            &nbsp;&middot;&nbsp;
            ${formatBytes(r.originalSize)} &rarr; <strong>${formatBytes(r.small.size)}</strong>
            &nbsp;&middot;&nbsp;
            <span class="savings">&minus;${savingsSmall}%</span>
          </span>
          <button class="btn-dl-version" data-id="${id}" data-version="small">Save</button>
        </div>
      </div>
    </div>
    <div class="card-done-badge">
      <span class="badge badge-done">Done</span>
    </div>`;
}

function drawThumbnail(id, blob) {
  const canvas = document.getElementById(`thumb-${id}`);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const scale = Math.min(56 / img.width, 56 / img.height);
    const w = img.width * scale, h = img.height * scale;
    ctx.drawImage(img, (56 - w) / 2, (56 - h) / 2, w, h);
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

// ─── Individual save buttons (event delegation) ───────────────────────────────

fileList.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-dl-version');
  if (!btn) return;
  const id = parseInt(btn.dataset.id, 10);
  const version = btn.dataset.version;
  const entry = files.find(f => f.id === id);
  if (!entry || entry.status !== 'done') return;

  if (version === 'full') {
    downloadBlob(entry.result.full.blob, outputName(entry.file.name));
  } else {
    downloadBlob(entry.result.small.blob, outputNameSmall(entry.file.name));
  }
});

// ─── Download ZIP ─────────────────────────────────────────────────────────────

downloadZipBtn.addEventListener('click', async () => {
  const done = files.filter(f => f.status === 'done');
  if (!done.length) return;

  downloadZipBtn.disabled = true;
  downloadZipBtn.textContent = 'Building ZIP…';

  try {
    const zip = new JSZip();
    const folder = sessionFolderName();
    const compressed      = zip.folder(`${folder}/compressed`);
    const compressedSmall = zip.folder(`${folder}/compressed-small`);

    for (const entry of done) {
      compressed.file(outputName(entry.file.name), entry.result.full.blob);
      compressedSmall.file(outputNameSmall(entry.file.name), entry.result.small.blob);
    }

    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'STORE', // images are already compressed — skip re-compression
    });

    downloadBlob(zipBlob, `${folder}.zip`);
  } catch (err) {
    alert('ZIP creation failed: ' + err.message);
  }

  updateUI(); // restore button state
});

// ─── Clear ────────────────────────────────────────────────────────────────────

clearBtn.addEventListener('click', () => {
  files.length = 0;
  nextId = 0;
  fileList.innerHTML = '';
  queueSection.classList.add('hidden');
  statsBar.classList.add('hidden');
  updateUI();
});

// ─── UI State ─────────────────────────────────────────────────────────────────

function updateUI() {
  const done = files.filter(f => f.status === 'done');
  const busy = files.some(f => f.status === 'processing' || f.status === 'pending');

  fileCountEl.textContent = files.length;

  if (done.length > 0) {
    downloadZipBtn.disabled = false;
    downloadZipBtn.textContent = `Download ZIP (${done.length} image${done.length !== 1 ? 's' : ''})`;
  } else {
    downloadZipBtn.disabled = true;
    downloadZipBtn.textContent = 'Download ZIP';
  }

  if (done.length > 0 && !busy) {
    const origTotal = done.reduce((s, f) => s + f.result.originalSize, 0);
    const fullTotal = done.reduce((s, f) => s + f.result.full.size, 0);
    const smallTotal = done.reduce((s, f) => s + f.result.small.size, 0);
    const pctFull  = Math.round((1 - fullTotal  / origTotal) * 100);
    const pctSmall = Math.round((1 - smallTotal / origTotal) * 100);
    statsBar.textContent =
      `${done.length} image${done.length !== 1 ? 's' : ''} ready`
      + `  ·  Full: ${formatBytes(origTotal)} → ${formatBytes(fullTotal)} (−${pctFull}%)`
      + `  ·  Small: → ${formatBytes(smallTotal)} (−${pctSmall}%)`;
    statsBar.classList.remove('hidden');
  } else {
    statsBar.classList.add('hidden');
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
