# Changelog

## 1.0.0

### Compatibility

- Preserved all seven `source-map-resolve@0.6.0` CommonJS APIs.
- Preserved callback and synchronous signatures, result shapes, source order,
  read URLs, `code === null`, XSSI handling, and `error.sourceMapData`.
- Retained legacy URL and Windows path behavior behind Golden Master and
  differential tests.

### Dependencies

- Removed the `atob` runtime package in favor of the standard Node `Buffer`
  primitive with a browser Web API fallback.
- Removed `decode-uri-component`; runtime dependencies are now zero.
- Removed Tape and JSHint; development dependencies are now zero.

### Security

- Replaced the vulnerable malformed-percent fallback with bounded linear UTF-8
  decoding, addressing the applicable denial-of-service advisories.
- Added long malformed input, large data URI, and invalid UTF-8 baselines.

### Implementation

- Kept the single-file CommonJS implementation and injected `read` design.
- Added dependency-free TypeScript declarations without adding a build step.

### Testing

- Added `node:test` Golden Master coverage for public APIs, callback timing,
  errors, data URIs, URL classes, source roots, ordering, and Windows paths.
- Added a self-contained 0.6.0 fixture for differential checks.

### CI

- Added maintained Node 22/24/26 coverage on Linux.
- Added Node 24 coverage on Windows and macOS.

### Packaging

- Renamed the package to `source-map-resolve-modern`.
- Added current repository metadata, Node engine requirements, types, and a
  package-content verification script.

### Documentation

- Replaced the deprecation notice with migration and API documentation.
- Added `ANALYSIS.md`, `COMPATIBILITY.md`, and `MODERNIZATION.md`.

## Upstream history

The pre-1.0 history is inherited from `source-map-resolve`. See the repository
history and upstream tags for releases 0.1.0 through 0.6.0.
