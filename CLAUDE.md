# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GPX Compressor is a client-side web application that reduces GPX file sizes to under 5MB. It runs entirely in the browser with no server-side processing.

## Development

This is a static site with no build process. To develop:

```bash
# Serve locally (any static server works)
python3 -m http.server 8000
# or
npx serve .
```

Then open http://localhost:8000 in a browser.

For deployment, push to GitHub and enable GitHub Pages from the main branch.

## Architecture

**Single-page application with three files:**
- `index.html` - UI structure with upload area, options, progress, and results sections
- `styles.css` - Dark theme styling
- `gpx-compressor.js` - All logic: file handling, parsing, compression, download

**Compression algorithms in gpx-compressor.js:**
1. **Basic compression** - Uniform point sampling. Uses binary search to find optimal sampling rate that produces a file just under 5MB.
2. **Smart compression** - Douglas-Peucker algorithm. Preserves points in curves/corners, removes points on straight sections. Binary searches on epsilon parameter to hit target size.

**Key functions:**
- `handleFile()` - Parses GPX, displays info, checks if compression needed
- `binarySearchCompression()` - Core optimization loop for both methods
- `douglasPeucker()` - Recursive line simplification algorithm
- `perpendicularDistance()` - Calculates point distance from line segment

## GPX Structure

GPX files contain `<trkseg>` elements with `<trkpt>` trackpoints. Each trackpoint has lat/lon attributes and optional children like `<ele>` (elevation). The compressor removes trackpoints while preserving XML structure and metadata.
