"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const path = require("node:path")

const modern = require("..")
const original = require("./fixtures/original-source-map-resolve")

const codeUrl = "http://example.com/a/b/app.js"
const jsonMap = JSON.stringify({ version: 3, sources: ["src.js"], mappings: "" })

function comment(url, style) {
  if (style === "at") return "//@ sourceMappingURL=" + url
  if (style === "css") return "/*# sourceMappingURL=" + url + " */"
  if (style === "crlf") return "/*\r\n//# sourceMappingURL=" + url + "\r\n*/"
  return "//# sourceMappingURL=" + url
}

function callAsync(api, args) {
  return new Promise((resolve) => {
    api.apply(null, args.concat(function(error, result) {
      resolve({ error: error, result: result })
    }))
  })
}

function errorSnapshot(error) {
  return error && {
    name: error.name,
    message: error.message,
    sourceMapData: error.sourceMapData
  }
}

function syncSnapshot(api, args) {
  try {
    return { result: api.apply(null, args) }
  } catch (error) {
    return { error: errorSnapshot(error) }
  }
}

test("exports the seven compatibility APIs", function() {
  assert.deepEqual(Object.keys(modern), [
    "resolveSourceMap",
    "resolveSourceMapSync",
    "resolveSources",
    "resolveSourcesSync",
    "resolve",
    "resolveSync",
    "parseMapToJSON"
  ])
  Object.values(modern).forEach(function(api) { assert.equal(typeof api, "function") })
})

test("golden master: sourceMappingURL comment forms and selection", function() {
  for (const style of [undefined, "at", "css", "crlf"]) {
    const result = modern.resolveSourceMapSync(comment("map.json", style), codeUrl, function() {
      return jsonMap
    })
    assert.equal(result.sourceMappingURL, "map.json")
    assert.equal(result.url, "http://example.com/a/b/map.json")
  }

  const multiple = comment("first.map") + "\n" + comment("second.map", "css")
  assert.equal(modern.resolveSourceMapSync(multiple, codeUrl, function() { return "{}" }).sourceMappingURL, "first.map")
  assert.equal(modern.resolveSourceMapSync(comment(""), codeUrl, function() { throw new Error("unread") }), null)
  assert.equal(modern.resolveSourceMapSync("no comment", codeUrl, function() { throw new Error("unread") }), null)
})

test("golden master: inline data URI forms, MIME types, and UTF-8", function() {
  const value = { version: 3, sources: ["日本語😊.js"], mappings: "" }
  const encoded = encodeURIComponent(JSON.stringify(value))
  const base64 = Buffer.from(JSON.stringify(value)).toString("base64")

  assert.deepEqual(
    modern.resolveSourceMapSync(comment("data:application/json," + encoded), codeUrl),
    { sourceMappingURL: "data:application/json," + encoded, url: null, sourcesRelativeTo: codeUrl, map: value }
  )
  assert.deepEqual(
    modern.resolveSourceMapSync(comment("data:text/json;base64," + base64), codeUrl),
    { sourceMappingURL: "data:text/json;base64," + base64, url: null, sourcesRelativeTo: codeUrl, map: value }
  )

  for (const uri of [
    "data:,",
    "data:text/plain,%7B%7D",
    "data:application/problem+json,%7B%7D"
  ]) {
    const snapshot = syncSnapshot(modern.resolveSourceMapSync, [comment(uri), codeUrl])
    assert.equal(snapshot.error.sourceMapData.sourceMappingURL, uri)
    assert.match(snapshot.error.message, /Unuseful data uri mime type/)
  }

  const malformed = syncSnapshot(modern.resolveSourceMapSync, [comment("data:application/json,%"), codeUrl])
  assert.equal(malformed.error.name, "URIError")
  assert.equal(malformed.error.sourceMapData.map, "%")

  const invalidUtf8 = syncSnapshot(modern.resolveSourceMapSync, [comment("data:application/json;base64,abc"), codeUrl])
  assert.equal(invalidUtf8.error.name, "TypeError")
  assert.equal(invalidUtf8.error.sourceMapData.map, "abc")
})

test("golden master: tolerant percent decoding preserves plus", function() {
  const cases = new Map([
    ["map%20file.json", "map file.json"],
    ["a%2Fb.json", "a/b.json"],
    ["%25.json", "%.json"],
    ["a+b.json", "a+b.json"],
    ["a%2Bb.json", "a+b.json"],
    ["%E3%81%82.json", "あ.json"],
    ["%.json", "%.json"],
    ["%ZZ.json", "%ZZ.json"],
    ["%E3%81.json", "%E3%81.json"],
    ["%2520.json", "%20.json"]
  ])

  for (const [sourceMappingURL, expectedRead] of cases) {
    let readUrl
    modern.resolveSourceMapSync(comment(sourceMappingURL), "", function(url) {
      readUrl = url
      return "{}"
    })
    assert.equal(readUrl, expectedRead)
  }
})

test("golden master: URL resolution classes", function() {
  const cases = new Map([
    ["relative/map.json", "http://example.com/a/b/relative/map.json"],
    ["../map.json", "http://example.com/a/map.json"],
    ["./map.json", "http://example.com/a/b/map.json"],
    ["/root/map.json", "http://example.com/root/map.json"],
    ["https://cdn.example/map.json", "https://cdn.example/map.json"],
    ["//cdn.example/map.json", "http://cdn.example/map.json"],
    ["?map=1", "http://example.com/a/b/app.js?map=1"],
    ["#map", "http://example.com/a/b/app.js#map"],
    ["data:application/json,%7B%7D", null]
  ])

  for (const [sourceMappingURL, expected] of cases) {
    const result = modern.resolveSourceMapSync(comment(sourceMappingURL), codeUrl, function() { return "{}" })
    assert.equal(result.url, expected)
  }
})

test("golden master: sourceRoot, sourcesContent, errors, and null read", function() {
  const error = new Error("missing")
  const map = {
    sources: ["a.js", "b.js", "c.js"],
    sourceRoot: "assets",
    sourcesContent: ["A", null, "C"]
  }
  const calls = []
  const result = modern.resolveSourcesSync(map, "http://example.com/maps/app.map", function(url) {
    calls.push(url)
    throw error
  })
  assert.deepEqual(result.sourcesResolved, [
    "http://example.com/maps/assets/a.js",
    "http://example.com/maps/assets/b.js",
    "http://example.com/maps/assets/c.js"
  ])
  assert.equal(result.sourcesContent[0], "A")
  assert.equal(result.sourcesContent[1], error)
  assert.equal(result.sourcesContent[2], "C")
  assert.deepEqual(calls, ["http://example.com/maps/assets/b.js"])

  assert.deepEqual(
    modern.resolveSourcesSync(map, "http://example.com/maps/app.map", null, { sourceRoot: false }),
    {
      sourcesResolved: [
        "http://example.com/maps/a.js",
        "http://example.com/maps/b.js",
        "http://example.com/maps/c.js"
      ],
      sourcesContent: []
    }
  )
  assert.equal(
    modern.resolveSourcesSync(map, "http://example.com/maps/app.map", null, { sourceRoot: "/override" }).sourcesResolved[0],
    "http://example.com/override/a.js"
  )
})

test("golden master: async order, timing, callback count, and read errors", async function() {
  let synchronous = true
  let count = 0
  const noMap = await new Promise(function(resolve) {
    modern.resolveSourceMap("", codeUrl, function() {}, function(error, result) {
      count++
      assert.equal(synchronous, false)
      resolve({ error: error, result: result })
    })
    synchronous = false
  })
  assert.deepEqual(noMap, { error: null, result: null })
  assert.equal(count, 1)

  const map = { sources: ["slow.js", "fast.js", "medium.js"] }
  const delays = { "slow.js": 40, "fast.js": 1, "medium.js": 15 }
  const asyncResult = await callAsync(modern.resolveSources, [
    map,
    "",
    function(url, callback) {
      setTimeout(function() { callback(url === "medium.js" ? new Error("missing") : null, url.toUpperCase()) }, delays[url])
    }
  ])
  assert.equal(asyncResult.error, null)
  assert.deepEqual(asyncResult.result.sourcesResolved, ["slow.js", "fast.js", "medium.js"])
  assert.equal(asyncResult.result.sourcesContent[0], "SLOW.JS")
  assert.equal(asyncResult.result.sourcesContent[1], "FAST.JS")
  assert.equal(asyncResult.result.sourcesContent[2].message, "missing")

  const sourceMap = await callAsync(modern.resolveSourceMap, [
    comment("map.json"),
    codeUrl,
    function(url, callback) { setImmediate(function() { callback(null, jsonMap) }) }
  ])
  assert.equal(sourceMap.error, null)
  assert.deepEqual(sourceMap.result.map, JSON.parse(jsonMap))

  const resolved = await callAsync(modern.resolve, [
    comment("map.json"),
    codeUrl,
    function(url, callback) {
      setImmediate(function() { callback(null, url.endsWith(".json") ? jsonMap : "SOURCE") })
    }
  ])
  assert.equal(resolved.error, null)
  assert.deepEqual(resolved.result.sourcesContent, ["SOURCE"])
})

test("golden master: Windows drive and backslash conversion", function() {
  const separator = path.sep
  path.sep = "\\"
  try {
    const result = modern.resolveSourceMapSync(
      comment("../maps/app.map"),
      "C:\\build\\js\\app.js",
      function() { return "{}" }
    )
    assert.equal(result.url, "/build/maps/app.map")
    assert.equal(
      modern.resolveSourcesSync(
        { sources: ["src\\input.js", "/root.js"] },
        "D:\\maps\\app.map",
        null
      ).sourcesResolved[0],
      "/maps/src/input.js"
    )
  } finally {
    path.sep = separator
  }
})

test("golden master: resolve(null) and XSSI/error partial data", async function() {
  const result = modern.resolveSync(null, "http://example.com/app.map", function(url) {
    if (url.endsWith(".map")) return ")]}'" + jsonMap
    return "source"
  })
  assert.equal(result.sourceMappingURL, null)
  assert.equal(result.url, "http://example.com/app.map")
  assert.deepEqual(result.map, JSON.parse(jsonMap))

  const marker = { partial: true }
  assert.deepEqual(modern.parseMapToJSON(")]}'{\"x\":1}"), { x: 1 })
  assert.throws(function() { modern.parseMapToJSON("not json", marker) }, function(error) {
    assert.equal(error.sourceMapData, marker)
    return true
  })

  const failed = await callAsync(modern.resolve, [null, "broken.map", function(url, callback) {
    callback(new Error("cannot read " + url))
  }])
  assert.equal(failed.error.message, "cannot read broken.map")
  assert.deepEqual(failed.error.sourceMapData, {
    sourceMappingURL: null,
    url: "broken.map",
    sourcesRelativeTo: "broken.map",
    map: null
  })
})

test("differential: sync results, read URLs, and errors match 0.6.0", function() {
  const comments = [
    comment("map%20file.json"),
    comment("../map.json", "css"),
    comment("data:application/json,%7B%22sources%22%3A%5B%5D%7D"),
    comment("data:application/json,broken"),
    "no map"
  ]

  for (const code of comments) {
    const currentCalls = []
    const originalCalls = []
    const current = syncSnapshot(modern.resolveSourceMapSync, [code, codeUrl, function(url) {
      currentCalls.push(url)
      return url.includes("map file") ? jsonMap : "{}"
    }])
    const baseline = syncSnapshot(original.resolveSourceMapSync, [code, codeUrl, function(url) {
      originalCalls.push(url)
      return url.includes("map file") ? jsonMap : "{}"
    }])
    if (current.error) current.error = errorSnapshot(current.error)
    if (baseline.error) baseline.error = errorSnapshot(baseline.error)
    assert.deepEqual(current, baseline)
    assert.deepEqual(currentCalls, originalCalls)
  }

  const map = { sources: ["a.js", "b.js"], sourceRoot: "../src", sourcesContent: [null, "B"] }
  function reader(url) { if (url.endsWith("a.js")) throw new Error("missing"); return url }
  const current = modern.resolveSourcesSync(map, codeUrl, reader)
  const baseline = original.resolveSourcesSync(map, codeUrl, reader)
  assert.deepEqual(current.sourcesResolved, baseline.sourcesResolved)
  assert.deepEqual(current.sourcesContent.map(errorSnapshot), baseline.sourcesContent.map(errorSnapshot))
})

test("differential: callback results and scheduling match 0.6.0", async function() {
  const map = { sources: ["a.js"], sourcesContent: ["A"] }
  const current = await callAsync(modern.resolveSources, [map, codeUrl, function() { throw new Error("unread") }])
  const baseline = await callAsync(original.resolveSources, [map, codeUrl, function() { throw new Error("unread") }])
  assert.deepEqual(current, baseline)
})

test("security baseline: malformed percent input completes in linear time", function() {
  const malformed = "%E3%81".repeat(20000) + ".json"
  const started = Date.now()
  modern.resolveSourceMapSync(comment(malformed), "", function() { return "{}" })
  assert.ok(Date.now() - started < 1000)
})

test("security baseline: large inline maps and invalid UTF-8 remain bounded", function() {
  const map = JSON.stringify({ sources: [], mappings: "A".repeat(1024 * 1024) })
  const base64 = Buffer.from(map).toString("base64")
  const percent = encodeURIComponent(map)
  assert.equal(
    modern.resolveSourceMapSync(comment("data:application/json;base64," + base64), codeUrl).map.mappings.length,
    1024 * 1024
  )
  assert.equal(
    modern.resolveSourceMapSync(comment("data:application/json," + percent), codeUrl).map.mappings.length,
    1024 * 1024
  )
  assert.throws(function() {
    modern.resolveSourceMapSync(comment("data:application/json;base64,abc"), codeUrl)
  }, TypeError)
})
