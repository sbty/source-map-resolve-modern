# Compatibility contract

`source-map-resolve-modern` targets the observable behavior of
`source-map-resolve@0.6.0` for these seven CommonJS exports:

- `resolveSourceMap` and `resolveSourceMapSync`
- `resolveSources` and `resolveSourcesSync`
- `resolve` and `resolveSync`
- `parseMapToJSON`

## Asynchronous behavior

The asynchronous APIs remain error-first callback APIs. No existing function
returns a Promise. Paths that do not need `read`, including no-comment results,
empty source lists, and inline `sourcesContent`, retain `setImmediate`-based
scheduling. Results that need `read` follow the injected callback's timing.
Normal success and failure paths invoke the public callback once.

## Source map comments

The embedded 0.6.0 regex is retained. It recognizes `//#`, `//@`, and CSS block
forms with LF or CRLF. The first matching comment wins. An absent or empty URL
produces `null` rather than an empty result object.

## Source map data

`resolveSourceMap` results keep all four properties:

```js
{ map, url, sourcesRelativeTo, sourceMappingURL }
```

Inline maps have `url: null` and resolve sources relative to `codeUrl`.
External maps use the resolved map URL for both URL properties. `resolve` adds
`sourcesResolved` and `sourcesContent`.

## Data URIs, base64, and percent encoding

Only `application/json` and `text/json` are accepted, matching 0.6.0. Both
percent-encoded and `;base64` payloads support UTF-8. Base64 keeps the prior
permissive Node semantics, while invalid UTF-8 remains fatal.

URLs are decoded only when passed to `read`. Valid percent escapes decode,
literal plus signs remain plus signs, and common malformed or truncated
escapes remain encoded. The intentionally bounded decoder may differ from the
old vulnerable package for contrived mixtures of many invalid UTF-8 bytes; see
`MODERNIZATION.md`.

## URL and Windows behavior

Legacy `url.resolve` semantics are retained for relative, absolute,
protocol-relative, query-only, fragment-only, `data:`, `file:`, and
filesystem-like inputs. WHATWG `URL` is not used where it would change output.

On Windows, backslashes are converted to `/` and the leading drive letter is
removed before resolving. This preserves 0.6.0, including its known limitation
for paths that cross drives. UNC and file-like values are not newly validated.

## Sources and source roots

Output order always follows `map.sources`, regardless of read completion order.
A string `options.sourceRoot` overrides `map.sourceRoot`; `false` ignores the
map value. Undefined, null, non-string, and empty roots behave as no root. A
non-empty root is forced to end in `/` before resolution.

String values already present in `map.sourcesContent` take priority and skip
`read`. Other entries are read. Per-source read errors are stored in
`sourcesContent[index]` and do not become a top-level failure.

`resolveSourcesSync(map, mapUrl, null)` fills `sourcesResolved` and returns an
empty `sourcesContent` array.

## Errors and partial results

Map read, inline data, decoding, and JSON parsing failures preserve the old
message where the underlying platform does. They attach the partial object to
`error.sourceMapData`. A JSON parse failure retains the unparsed string in its
partial `map` property. Source read failures remain array values as described
above.

## Special cases

- `resolve(null, mapUrl, ...)` and its sync counterpart read `mapUrl` directly.
- That special result contains `sourceMappingURL: null`, not `undefined`.
- `parseMapToJSON` strips a leading `)]}'` XSSI prefix.
- No source-map schema or URL validation is added.

