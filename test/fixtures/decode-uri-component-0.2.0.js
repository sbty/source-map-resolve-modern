"use strict"

// decode-uri-component@0.2.0, retained under its MIT license for differential tests.
var token = "%[a-f0-9]{2}"
var singleMatcher = new RegExp(token, "gi")
var multiMatcher = new RegExp("(" + token + ")+", "gi")

function decodeComponents(components, split) {
  try {
    return decodeURIComponent(components.join(""))
  } catch (error) {}

  if (components.length === 1) return components
  split = split || 1
  return Array.prototype.concat.call(
    [],
    decodeComponents(components.slice(0, split)),
    decodeComponents(components.slice(split))
  )
}

function decode(input) {
  try {
    return decodeURIComponent(input)
  } catch (error) {
    var tokens = input.match(singleMatcher)
    for (var index = 1; index < tokens.length; index++) {
      input = decodeComponents(tokens, index).join("")
      tokens = input.match(singleMatcher)
    }
    return input
  }
}

function customDecodeUriComponent(input) {
  var replaceMap = { "%FE%FF": "\uFFFD\uFFFD", "%FF%FE": "\uFFFD\uFFFD" }
  var match = multiMatcher.exec(input)
  while (match) {
    try {
      replaceMap[match[0]] = decodeURIComponent(match[0])
    } catch (error) {
      var result = decode(match[0])
      if (result !== match[0]) replaceMap[match[0]] = result
    }
    match = multiMatcher.exec(input)
  }
  replaceMap["%C2"] = "\uFFFD"
  Object.keys(replaceMap).forEach(function(key) {
    input = input.replace(new RegExp(key, "g"), replaceMap[key])
  })
  return input
}

module.exports = function decodeUriComponentFixture(encodedURI) {
  if (typeof encodedURI !== "string") {
    throw new TypeError("Expected `encodedURI` to be of type `string`, got `" + typeof encodedURI + "`")
  }
  try {
    return decodeURIComponent(encodedURI.replace(/\+/g, " "))
  } catch (error) {
    return customDecodeUriComponent(encodedURI.replace(/\+/g, " "))
  }
}

