"use strict"

// Equivalent to atob@2.1.2's Node entry point.
module.exports = function atobFixture(string) {
  return Buffer.from(string, "base64").toString("binary")
}

