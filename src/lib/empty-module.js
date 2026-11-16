// Stand-in for Node built-ins in browser bundles. The Piper voice engine (Emscripten)
// mentions "fs"/"path" in code that only runs under Node, never in the browser.
module.exports = {};
