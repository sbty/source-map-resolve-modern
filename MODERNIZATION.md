# Modernization decisions

## Runtime dependencies

Runtime dependencies were reduced from two to zero. The implementation remains
a single CommonJS `index.js`; no build step, framework, or package-internal
service layer was added.

## `atob`

`atob@2.1.2` used `Buffer.from(value, "base64")` in Node. The modern code calls
that standard primitive directly, retaining its permissive padding and
whitespace behavior, then uses `TextDecoder("utf-8", { fatal: true })` exactly
as before. When `Buffer` is unavailable, the browser's `globalThis.atob` is a
best-effort fallback.

## `decode-uri-component`

`decode-uri-component@0.2.0` was removed because it is affected by
CVE-2022-38900 and its later releases through 0.4.2 are affected by
CVE-2026-45822. The old malformed-input fallback repeatedly repartitioned token
arrays and could take exponential time.

The replacement first uses native `decodeURIComponent`. On failure, a small
scanner decodes valid UTF-8 percent runs in linear time, leaves malformed runs
encoded, and preserves literal `+`. Recorded ordinary edge cases match 0.6.0.
For adversarial mixtures of invalid UTF-8 bytes, exact quirks of the vulnerable
algorithm are intentionally not reproduced. No input-size limit was added.

## URL resolution

The legacy Node URL resolver was investigated but retained. Node documents it
as legacy and offers a WHATWG-based replacement, but the replacement needs a
synthetic base for relative paths and differs on filesystem-like, Windows, and
some encoded inputs. Since resolved strings and read-call URLs are public
behavior, modernity alone does not justify that break.

## Windows paths

The existing two-step conversion (backslashes to slashes, then leading drive
removal) remains inline. It is only a few characters of behavior and matches
the Golden Master. Depending on `urix-modern` would add a runtime edge without
fixing the cross-drive limitation compatibly; `pathToFileURL` would change the
contract to file URLs.

## Source-map comment detection

The 0.6.0 regex remains embedded. Direct package inspection confirmed that
`source-map-url@0.4.1` and `source-map-url-modern@1.0.1` contain the identical
regex and `getFrom` behavior. Adding either dependency would not change or
improve detection, and their additional mutation helpers are unused. An AST
parser was not added. Changing which comment wins or distinguishing comments
from comment-like string contents would be a feature and compatibility change.

`resolve-url-modern@0.3.0` was also rejected because it resolves through browser
DOM `<base>` and `<a>` elements, not the Node/filesystem-like contract here.
`urix-modern@0.1.1` was rejected because its production function is exactly the
same small Windows replacement already inlined in this module.

## Tests

Tape and JSHint were replaced with `node:test`, `node:assert`, and a syntax
check. A preserved self-contained 0.6.0 fixture supports differential tests.
Golden Masters cover all seven exports, callbacks, errors, read URLs, data
URIs, source roots, ordering, XSSI, and Windows conversion. Security baselines
exercise long malformed percent input and large inline maps. There are no test
framework or lint dependencies.

## Node and browser support

The supported Node floor is 22. At implementation time, Node 22 and 24 are LTS
and Node 26 is Current. CI covers all three on Linux and Node 24 on Windows and
macOS.

Upstream 0.6.0 explicitly removed its browser build. This fork keeps injected
reads and browser-compatible decoding fallbacks but does not claim formal
browser support in 1.0.0. Adding a browser matrix later should be driven by a
documented consumer need, not by an automatic fetch or a new runtime bundle.

## Intentionally retained quirks

- callback APIs and `setImmediate` scheduling
- duplicate-looking sync and async orchestration
- only `application/json` and `text/json` inline MIME types
- source-read errors as `sourcesContent` entries
- empty `sourceRoot` meaning no root and forced trailing slashes otherwise
- legacy URL resolution and lossy Windows drive conversion
- partial `error.sourceMapData` objects and existing error messages
