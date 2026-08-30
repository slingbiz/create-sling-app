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

test("next steps send people to Studio, the API, then the storefront", () => {
  const { printRunningNextSteps } = require("./installUi");
  const logs = [];
  const original = console.log;
  console.log = (line) => logs.push(String(line));
  try {
    printRunningNextSteps({});
  } finally {
    console.log = original;
  }
  const text = logs.join("\n");
  assert.match(text, /localhost:2021/);
  assert.match(text, /localhost:10001/);
  assert.match(text, /localhost:4087/);
  assert.match(text, /Sign up/);
  assert.match(text, /API at/);
});

test("progress can set a hint and stop", () => {
  const progress = startProgress();
  progress.hint("Installing Studio packages");
  progress.succeed("Ready.");
});
