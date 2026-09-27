# Investigation and compatibility analysis

## Scope and baseline

This repository is the `source-map-resolve` 0.6.0 codebase at upstream commit
`cc2b81c`. The upstream repository was archived on 2023-11-04. Its production
implementation is a single 369-line CommonJS file and exports these seven APIs:

1. `resolveSourceMap(code, codeUrl, read, callback)`
2. `resolveSourceMapSync(code, codeUrl, read)`
3. `resolveSources(map, mapUrl, read, options?, callback)`
4. `resolveSourcesSync(map, mapUrl, read, options?)`
5. `resolve(code, codeUrl, read, options?, callback)`
6. `resolveSync(code, codeUrl, read, options?)`
7. `parseMapToJSON(string, data?)`

On Node.js 22.18.0, the unmodified 0.6.0 suite passes all 544 assertions (500
core, 14 read/percent-decoding, and 30 Windows-path assertions). The baseline
install reports six high-severity audit findings. The production-relevant one
is the direct `decode-uri-component@0.2.0` dependency; the others are in the old
JSHint/Tape development tree.

## Data flow

`resolveSourceMap` extracts the first matching source map comment. Inline data
URIs are decoded and parsed immediately; external map URLs are resolved, decoded
only when passed to the injected `read`, converted to a string, and parsed.
`resolveSources` resolves every `map.sources` entry in map order. Embedded
string entries in `sourcesContent` bypass `read`; absent or non-string entries
are read. A source read failure is stored at its array index instead of failing
the whole operation. `resolve` composes those two operations. Passing `null` as
its code makes `codeUrl` the map URL and preserves `sourceMappingURL: null`.

The sync APIs duplicate the orchestration rather than wrapping the callback
APIs. `resolveSourcesSync(..., null)` still resolves URLs but leaves
`sourcesContent` empty.

## Observable compatibility points

- Source map result keys are `sourceMappingURL`, `url`, `sourcesRelativeTo`,
  and `map`, with `url: null` for data URIs and a literal `null` result when no
  comment is found.
- `resolve` adds `sourcesResolved` and `sourcesContent` to that same object.
- The comment regex accepts `//#`, `//@`, and block-comment forms, allows LF or
  CRLF around the marker, captures no whitespace or quotes, and returns the
  first match. An empty captured URL is treated as no map because the helper
  tests `if (!url)`.
- Inline maps accept only `application/json` and `text/json`. Parameters are
  tolerated, but base64 decoding is selected only when the last captured
  parameter is exactly `;base64`.
- Base64 decoding is permissive because `atob@2.1.2` is implemented in Node as
  `Buffer.from(value, "base64").toString("binary")`; UTF-8 conversion then uses
  `TextDecoder("utf-8", { fatal: true })` when available.
- URLs passed to `read` use tolerant percent decoding. Literal `+` is preserved,
  valid escapes are decoded, and malformed escapes normally remain encoded.
- URL composition uses legacy `url.resolve`. WHATWG `URL` is not a drop-in
  replacement for relative bases, filesystem-like inputs, or all historical
  edge cases.
- On Windows, backslashes become slashes and a leading drive designator is
  removed (`C:\\a\\b` becomes `/a/b`) before URL resolution. This intentionally
  preserves the old, lossy behavior, including its multi-drive limitation.
- A source root string in options wins over `map.sourceRoot`; `false` suppresses
  the map value. `null`, non-strings, and `""` mean no root. A non-empty root is
  forced to end in `/` before resolving a source.
- Empty-source and inline-only async completions are scheduled with
  `setImmediate`. Paths involving an injected async `read` complete when that
  callback completes. No Promise or microtask scheduling is involved.
- Parse and map-read failures attach the partial result as `error.sourceMapData`.
  Individual source-read failures are values in `sourcesContent`, not top-level
  errors.

## `next` branch

Upstream `next` is nine commits ahead of the common commit `e60030b` and was
merged as PR #20 in April 2020. It converts injected reads and the three async
entry points to Promises, removes all three sync APIs, converts the source loop
to a generator, ports Tape tests to Jest, replaces JSHint with ESLint, and adds
Prettier. It retains both production dependencies and legacy URL resolution.

Those changes address code style, test tooling, and an alternative asynchronous
API design, but they intentionally break the callback and sync contracts. The
branch therefore cannot be adopted for this compatibility fork. Its test-port
ideas are useful, but `node:test` now covers the same need without Jest,
ESLint, or Prettier dependency trees. The likely reason it was never released
as 1.0 is that it remained on an unreleased branch while the maintainer later
deprecated and archived the general-purpose resolver; the repository does not
record a more specific rejection rationale.

## Issues, pull requests, forks, and security history

The two open upstream issues are #9 (incorrect Windows resolution across
multiple drives) and #12 (the planned 1.0 modernization). The public repository
currently shows no open pull requests; PR #20 is the merged work represented by
`next`. The repository has about thirty forks, but no examined upstream history
identifies a maintained successor that preserves all seven APIs.

`decode-uri-component@0.2.0` is affected by CVE-2022-38900 / GHSA-w573-4hg7-7wgq.
A later advisory, CVE-2026-45822 / GHSA-vcc3-ghjq-m6fr, covers versions through
0.4.2 and describes exponential work on malformed percent input. Replacing the
dependency with a bounded, linear compatibility decoder is preferable to a
version bump that still changes behavior or remains affected. The library adds
no new input-size limit because that would be a compatibility break.

## Modernization decisions

- Preserve all seven CommonJS APIs, callback signatures, result shapes, errors,
  and `setImmediate` scheduling.
- Use `node:test` and `node:assert`; remove Tape and JSHint rather than replacing
  them with another third-party toolchain.
- Keep the source-map comment regex internal; adding a package provides no
  compatibility or maintenance benefit. The published `source-map-url@0.4.1`
  and `source-map-url-modern@1.0.1` files use the byte-for-byte same inner and
  outer regex as this module. The modern package also exports unrelated edit
  helpers, so depending on it would add an edge without changing detection.
- Replace `atob` with the same Node primitive it wraps, while retaining a browser
  fallback when `Buffer` is unavailable.
- Replace `decode-uri-component` with a small linear UTF-8 percent decoder that
  preserves the measured malformed-input behavior and literal plus signs.
- Retain legacy `url.resolve` for this release. It is a documented legacy API,
  but differential tests show that URL semantics—not API age—are the public
  contract. A future replacement requires a complete compatibility table.
- Retain the tiny Windows conversion inline. `pathToFileURL` and external `urix`
  packages have different semantics or unnecessary dependency cost.
  `urix-modern@0.1.1` implements the same two replacements as the existing
  inline helper, so using it would only move six lines behind a dependency.
- Do not use `resolve-url-modern@0.3.0`: it is a browser/DOM implementation
  based on temporary `<base>` and `<a>` elements, whereas this package needs
  Node and filesystem-like legacy semantics without a DOM runtime dependency.
- Support maintained Node releases only. At investigation time, Node 22 and 24
  are LTS and Node 26 is Current; CI uses Linux for all three and Windows/macOS
  on Node 24.
- Keep browser use best-effort through bundlers and injected reads, not a formal
  support claim, because 0.6.0 explicitly removed its browser build. No fetch or
  filesystem implementation is added.

## Golden-master and differential plan

The new test suite first records comment variants, data URI and MIME behavior,
base64/UTF-8 failures, percent decoding, URL classes, sourceRoot precedence,
mixed `sourcesContent`, read failures, result ordering, `code === null`, XSSI,
partial `sourceMapData`, and callback timing/count. A preserved 0.6.0 fixture is
then run beside the modern module for representative sync and callback cases,
including read-call URLs and error snapshots. Security tests cover long valid
and malformed percent runs, large inline payloads, invalid UTF-8, and permissive
base64 without adding production resource limits.
