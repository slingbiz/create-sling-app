const test = require("node:test");
const assert = require("node:assert/strict");
const { printBanner, startProgress } = require("./installUi");

test("prints a sling.biz banner", () => {
  const logs = [];
  const original = console.log;
  console.log = (line) => logs.push(String(line));
  try {
    printBanner();
  } finally {
    console.log = original;
  }
  assert.match(logs.join("\n"), /sling\.biz/);
  assert.match(logs.join("\n"), /Sling CMS/);
});

test("progress can set a hint and stop", () => {
  const progress = startProgress();
  progress.hint("Installing Studio packages");
  progress.succeed("Ready.");
});
