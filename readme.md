# source-map-resolve-modern

A maintained, dependency-free compatibility fork of the archived
[`source-map-resolve`](https://github.com/lydell/source-map-resolve). It keeps the
0.6.0 callback and synchronous APIs while replacing vulnerable runtime
dependencies and modernizing tests, CI, packaging, and documentation.

This project is deliberately not a new source-map parser. It preserves the old
resolver's observable behavior so existing integrations can migrate with a
package-name change.

## Installation

```sh
npm install source-map-resolve-modern
```

CommonJS remains the supported entry point:

```js
const sourceMapResolve = require("source-map-resolve-modern")
```

After publication, npm aliasing can preserve an existing import name:

```json
{
  "dependencies": {
    "source-map-resolve": "npm:source-map-resolve-modern@^1.0.0"
  }
}
```

Then existing `require("source-map-resolve")` calls do not need to change.

## API

### `resolveSourceMap(code, codeUrl, read, callback)`

Finds a `sourceMappingURL`, reads an external map when needed, and calls back
with `null` or:

```js
{
  map,
  url,
  sourcesRelativeTo,
  sourceMappingURL
}
```

If no usable comment exists, the result is exactly `null`. Inline
`application/json` and `text/json` data URIs are supported in percent-encoded
and base64 forms.

### `resolveSources(map, mapUrl, read, [options], callback)`

Resolves `map.sources` and returns:

```js
{
  sourcesResolved: [],
  sourcesContent: []
}
```

`options.sourceRoot` may be a replacement string or `false` to ignore the
map's `sourceRoot`. Existing string entries in `map.sourcesContent` are used
without calling `read`. A failed source read is stored as an `Error` at the
matching `sourcesContent` index; it does not fail the entire call.

### `resolve(code, codeUrl, read, [options], callback)`

Combines `resolveSourceMap` and `resolveSources`. When `code === null`,
`codeUrl` is treated as the source map URL and the result contains
`sourceMappingURL: null`.

### Synchronous APIs

`resolveSourceMapSync`, `resolveSourcesSync`, and `resolveSync` have the same
result shapes and throw instead of using callbacks. `resolveSourcesSync` accepts
`null` as `read`; URLs are resolved and `sourcesContent` remains empty.

### `parseMapToJSON(string, [data])`

Removes the source-map XSSI prefix `)]}'` and parses JSON. A thrown parse error
contains `error.sourceMapData === data`.

## The read abstraction

The package never accesses the filesystem or network itself. Callers inject:

```js
function read(url, callback) {
  // callback(error, contents)
}

function readSync(url) {
  return contents
}
```

This keeps filesystem, HTTP, memory, and virtual-filesystem policies outside
the resolver. No automatic `fetch` behavior is included.

## Compatibility policy

The seven 0.6.0 exports, argument order, callback model, synchronous APIs,
result keys, `null` values, read URLs, source ordering, and
`error.sourceMapData` are compatibility targets. See
[COMPATIBILITY.md](COMPATIBILITY.md) for the detailed contract.

One deliberate security difference exists: pathological malformed percent
sequences are decoded by a bounded linear scanner instead of reproducing the
vulnerable dependency's exponential fallback. Normal valid and common invalid
inputs retain the recorded 0.6.0 behavior.

## Node and browser support

Node.js 22 and newer are supported. CI covers Node 22, 24, and 26, plus Linux,
Windows, and macOS.

The 0.6.0 release removed its browser build, so browser use is best-effort
rather than a formal compatibility guarantee. The implementation keeps
browser-friendly injected reads and Web API fallbacks, but no bundled browser
artifact or Playwright matrix is shipped in 1.0.0.

## Migration from `source-map-resolve`

1. Replace the dependency with `source-map-resolve-modern`, directly or with
   the npm alias shown above.
2. Keep callback and sync call sites unchanged.
3. Run integration tests that exercise custom `read` functions, especially
   filesystem-like and Windows paths.
4. Review the security-related malformed-percent difference.

No Promise-only, ESM-only, TypeScript build, schema validation, automatic
fetching, or source-map consumer is introduced.

## Security

The vulnerable `decode-uri-component` dependency and the redundant `atob`
package were removed. Runtime dependencies are zero. The package intentionally
does not impose a source-map size limit because that would reject inputs
accepted by 0.6.0; callers that process untrusted data should enforce limits at
their own read/input boundary.

See [MODERNIZATION.md](MODERNIZATION.md) for implementation decisions and
[ANALYSIS.md](ANALYSIS.md) for the upstream investigation.

## License

MIT. Original copyright notices are retained in [LICENSE](LICENSE).
