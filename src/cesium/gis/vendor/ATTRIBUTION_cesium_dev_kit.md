# cesium_dev_kit Attribution

## Source

- **Repository**: https://github.com/dengxiaoning/cesium_dev_kit
- **Commit**: f4cb88e082e478756adf7ec216e84d87c4830709
- **Date**: 2025-09-29
- **License**: MIT License
- **Copyright**: (c) cesium_dev_kit contributors

## Files Extracted

- `Analysis.js` - Volume calculation algorithms extracted to `src/cesium/gis/utils/volume.ts`
  - `computeAreaOfTriangle()` - Calculate triangle area using Heron's formula
  - `computeCentroidOfPolygon()` - Calculate polygon centroid for label positioning
  - `computeCutVolume()` - Core volume calculation algorithm using triangle mesh

## Algorithm Description

The volume calculation algorithm works by:

1. Subdividing the polygon into a dense triangle mesh using `Cesium.PolygonGeometry`
2. Sampling terrain elevation at each triangle vertex using `viewer.scene.globe.getHeight()`
3. Computing the volume of each triangular prism: `V = (base_area × (h1 + h2 + h3)) / 3`
4. Summing all prism volumes to get total cut/fill volume

This is particularly useful for water conservancy projects to calculate:

- Reservoir capacity
- Earthwork volume (cut and fill)
- Flood inundation volume

## Purpose

These algorithms provide accurate 3D volume calculation capabilities for the GIS toolkit, enabling water conservancy engineers to perform terrain analysis and capacity calculations.

## License Text

MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
