# GPX Compressor

A client-side web tool to reduce GPX file sizes while preserving route accuracy. Runs entirely in the browser - no uploads to any server.

**[Use the tool here](https://pookey.github.io/gpx-tools/)**

## Features

- **Basic Compression** - Uniformly samples points to reach target file size
- **Smart Compression** - Uses Douglas-Peucker algorithm to preserve detail in curves while simplifying straight sections
- Configurable target size (1MB - 10MB)
- Drag and drop file upload
- Works offline after initial page load

## How It Works

GPX files store routes as sequences of latitude/longitude points. Large files often contain more points than necessary. This tool reduces file size by intelligently removing points while maintaining the shape of the route.

**Basic compression** keeps every Nth point uniformly along the route.

**Smart compression** analyzes the geometry and keeps more points where the route curves (corners, junctions) and fewer points on straight sections.

## License

MIT License - see [LICENSE](LICENSE)
