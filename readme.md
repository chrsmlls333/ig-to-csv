# Simple .ig to .csv Converter

Use `npm link` to call `ig-to-csv --file {path}` in any folder, or simply call `node .\ig-to-csv.js --file {path}` in the project clone folder.

Converts CERN .ig files or individual event JSON files into custom CSV track data, including start and end points, along with particle data for use in 3D modeling software like Houdini. 3D bezier curves can be derived from this, or NURBS curves.

Currently does not handle any other data collections like sensor hits, etc. Some code plundered from [ispy-webgl](https://github.com/cms-outreach/ispy-webgl).
