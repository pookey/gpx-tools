const TARGET_SIZE = 5 * 1024 * 1024; // 5MB in bytes

// DOM Elements
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const originalSize = document.getElementById('originalSize');
const pointCount = document.getElementById('pointCount');
const compressionOptions = document.getElementById('compressionOptions');
const compressBtn = document.getElementById('compressBtn');
const progressSection = document.getElementById('progressSection');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const resultSection = document.getElementById('resultSection');
const newSize = document.getElementById('newSize');
const reduction = document.getElementById('reduction');
const newPointCount = document.getElementById('newPointCount');
const downloadBtn = document.getElementById('downloadBtn');
const resetBtn = document.getElementById('resetBtn');
const alreadySmall = document.getElementById('alreadySmall');
const smallFileSize = document.getElementById('smallFileSize');
const resetSmallBtn = document.getElementById('resetSmallBtn');

// State
let currentFile = null;
let gpxDoc = null;
let compressedGpxString = null;

// Utility functions
function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function formatNumber(num) {
  return num.toLocaleString();
}

// File handling
uploadArea.addEventListener('click', () => fileInput.click());
uploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadArea.classList.add('dragover');
});
uploadArea.addEventListener('dragleave', () => {
  uploadArea.classList.remove('dragover');
});
uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file && file.name.endsWith('.gpx')) {
    handleFile(file);
  }
});
fileInput.addEventListener('change', (e) => {
  if (e.target.files[0]) {
    handleFile(e.target.files[0]);
  }
});

async function handleFile(file) {
  currentFile = file;

  // Check if already under target size
  if (file.size <= TARGET_SIZE) {
    uploadArea.hidden = true;
    alreadySmall.hidden = false;
    smallFileSize.textContent = formatSize(file.size);
    return;
  }

  // Parse GPX
  const text = await file.text();
  const parser = new DOMParser();
  gpxDoc = parser.parseFromString(text, 'application/xml');

  const points = gpxDoc.querySelectorAll('trkpt');

  // Display file info
  fileName.textContent = file.name;
  originalSize.textContent = formatSize(file.size);
  pointCount.textContent = formatNumber(points.length);

  uploadArea.hidden = true;
  fileInfo.hidden = false;
  compressionOptions.hidden = false;
}

// Compression
compressBtn.addEventListener('click', async () => {
  const method = document.querySelector('input[name="method"]:checked').value;

  compressionOptions.hidden = true;
  progressSection.hidden = false;

  // Use setTimeout to allow UI to update
  await new Promise(r => setTimeout(r, 50));

  if (method === 'basic') {
    await compressBasic();
  } else {
    await compressSmart();
  }
});

async function compressBasic() {
  updateProgress(10, 'Analyzing GPX structure...');
  await new Promise(r => setTimeout(r, 50));

  const serializer = new XMLSerializer();
  const originalPoints = Array.from(gpxDoc.querySelectorAll('trkpt'));
  const originalCount = originalPoints.length;

  // Calculate approximate bytes per point
  const originalString = serializer.serializeToString(gpxDoc);
  const headerFooterSize = estimateHeaderFooterSize(originalString, originalCount);
  const avgPointSize = (currentFile.size - headerFooterSize) / originalCount;

  // Calculate target point count
  const targetPointBytes = TARGET_SIZE - headerFooterSize - 1024; // Leave 1KB buffer
  let targetPointCount = Math.floor(targetPointBytes / avgPointSize);

  updateProgress(20, 'Calculating optimal reduction...');
  await new Promise(r => setTimeout(r, 50));

  // Binary search to find optimal sampling rate
  let result = await binarySearchCompression(originalPoints, targetPointCount, 'basic');

  updateProgress(90, 'Finalizing...');
  await new Promise(r => setTimeout(r, 50));

  showResults(result.gpxString, result.keptCount, originalCount);
}

async function compressSmart() {
  updateProgress(10, 'Analyzing track geometry...');
  await new Promise(r => setTimeout(r, 50));

  const serializer = new XMLSerializer();
  const trksegs = gpxDoc.querySelectorAll('trkseg');
  const originalCount = gpxDoc.querySelectorAll('trkpt').length;

  // Calculate target size
  const originalString = serializer.serializeToString(gpxDoc);
  const headerFooterSize = estimateHeaderFooterSize(originalString, originalCount);
  const avgPointSize = (currentFile.size - headerFooterSize) / originalCount;
  const targetPointCount = Math.floor((TARGET_SIZE - headerFooterSize - 1024) / avgPointSize);

  updateProgress(20, 'Applying Douglas-Peucker algorithm...');
  await new Promise(r => setTimeout(r, 50));

  // Binary search for optimal epsilon value
  let result = await binarySearchCompression(null, targetPointCount, 'smart', trksegs);

  updateProgress(90, 'Finalizing...');
  await new Promise(r => setTimeout(r, 50));

  showResults(result.gpxString, result.keptCount, originalCount);
}

async function binarySearchCompression(originalPoints, targetCount, method, trksegs = null) {
  const serializer = new XMLSerializer();
  let bestResult = null;

  if (method === 'basic') {
    // Binary search on sampling rate
    let low = 1;
    let high = originalPoints.length;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const step = Math.max(1, Math.floor(originalPoints.length / mid));

      // Create compressed version
      const testDoc = gpxDoc.cloneNode(true);
      const testPoints = Array.from(testDoc.querySelectorAll('trkpt'));

      let kept = 0;
      for (let i = 0; i < testPoints.length; i++) {
        if (i % step === 0 || i === testPoints.length - 1) {
          kept++;
        } else {
          testPoints[i].remove();
        }
      }

      const testString = serializer.serializeToString(testDoc);
      const testSize = new Blob([testString]).size;

      updateProgress(20 + Math.floor((high - low) / originalPoints.length * 60),
        `Testing ${formatNumber(kept)} points (${formatSize(testSize)})...`);
      await new Promise(r => setTimeout(r, 10));

      if (testSize <= TARGET_SIZE) {
        bestResult = { gpxString: testString, keptCount: kept, size: testSize };
        low = mid + 1; // Try to keep more points
      } else {
        high = mid - 1; // Need fewer points
      }
    }
  } else {
    // Binary search on epsilon for Douglas-Peucker
    let low = 0.000001;
    let high = 0.01;

    for (let iter = 0; iter < 20; iter++) {
      const epsilon = (low + high) / 2;

      const testDoc = gpxDoc.cloneNode(true);
      const testTrksegs = testDoc.querySelectorAll('trkseg');
      let totalKept = 0;

      testTrksegs.forEach(trkseg => {
        const points = Array.from(trkseg.querySelectorAll('trkpt'));
        if (points.length < 3) {
          totalKept += points.length;
          return;
        }

        const coords = points.map(p => ({
          lat: parseFloat(p.getAttribute('lat')),
          lon: parseFloat(p.getAttribute('lon')),
          element: p
        }));

        const keepIndices = douglasPeucker(coords, epsilon);
        const keepSet = new Set(keepIndices);

        for (let i = 0; i < points.length; i++) {
          if (!keepSet.has(i)) {
            points[i].remove();
          } else {
            totalKept++;
          }
        }
      });

      const testString = serializer.serializeToString(testDoc);
      const testSize = new Blob([testString]).size;

      updateProgress(20 + iter * 3,
        `Testing epsilon ${epsilon.toFixed(6)} (${formatNumber(totalKept)} points, ${formatSize(testSize)})...`);
      await new Promise(r => setTimeout(r, 10));

      if (testSize <= TARGET_SIZE) {
        bestResult = { gpxString: testString, keptCount: totalKept, size: testSize };
        high = epsilon; // Try smaller epsilon to keep more points
      } else {
        low = epsilon; // Need larger epsilon to remove more points
      }

      // Good enough if within 95% of target
      if (bestResult && bestResult.size > TARGET_SIZE * 0.95) {
        break;
      }
    }
  }

  return bestResult;
}

// Douglas-Peucker algorithm for smart compression
function douglasPeucker(points, epsilon) {
  if (points.length < 3) {
    return points.map((_, i) => i);
  }

  // Find the point with maximum distance from line between first and last
  let maxDist = 0;
  let maxIndex = 0;

  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], start, end);
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }

  // If max distance is greater than epsilon, recursively simplify
  if (maxDist > epsilon) {
    const left = douglasPeucker(points.slice(0, maxIndex + 1), epsilon);
    const right = douglasPeucker(points.slice(maxIndex), epsilon);

    // Combine results, avoiding duplicate at maxIndex
    const result = left.slice(0, -1).concat(right.map(i => i + maxIndex));
    return result;
  } else {
    // All points between can be removed
    return [0, points.length - 1];
  }
}

function perpendicularDistance(point, lineStart, lineEnd) {
  const dx = lineEnd.lon - lineStart.lon;
  const dy = lineEnd.lat - lineStart.lat;

  if (dx === 0 && dy === 0) {
    // Line is actually a point
    return Math.sqrt(
      Math.pow(point.lon - lineStart.lon, 2) +
      Math.pow(point.lat - lineStart.lat, 2)
    );
  }

  const t = Math.max(0, Math.min(1,
    ((point.lon - lineStart.lon) * dx + (point.lat - lineStart.lat) * dy) /
    (dx * dx + dy * dy)
  ));

  const projLon = lineStart.lon + t * dx;
  const projLat = lineStart.lat + t * dy;

  return Math.sqrt(
    Math.pow(point.lon - projLon, 2) +
    Math.pow(point.lat - projLat, 2)
  );
}

function estimateHeaderFooterSize(gpxString, pointCount) {
  // Estimate size of everything except trackpoints
  const pointPattern = /<trkpt[^>]*>[\s\S]*?<\/trkpt>/g;
  const withoutPoints = gpxString.replace(pointPattern, '');
  return new Blob([withoutPoints]).size;
}

function updateProgress(percent, text) {
  progressFill.style.width = percent + '%';
  progressText.textContent = text;
}

function showResults(gpxString, keptCount, originalCount) {
  compressedGpxString = gpxString;
  const compressedSize = new Blob([gpxString]).size;
  const reductionPercent = ((1 - compressedSize / currentFile.size) * 100).toFixed(1);

  progressSection.hidden = true;
  resultSection.hidden = false;

  newSize.textContent = formatSize(compressedSize);
  reduction.textContent = reductionPercent + '%';
  newPointCount.textContent = formatNumber(keptCount);
}

// Download
downloadBtn.addEventListener('click', () => {
  const blob = new Blob([compressedGpxString], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = currentFile.name.replace('.gpx', '_compressed.gpx');
  a.click();
  URL.revokeObjectURL(url);
});

// Reset
function reset() {
  currentFile = null;
  gpxDoc = null;
  compressedGpxString = null;
  fileInput.value = '';

  uploadArea.hidden = false;
  fileInfo.hidden = true;
  compressionOptions.hidden = true;
  progressSection.hidden = true;
  resultSection.hidden = true;
  alreadySmall.hidden = true;
  progressFill.style.width = '0%';
}

resetBtn.addEventListener('click', reset);
resetSmallBtn.addEventListener('click', reset);
