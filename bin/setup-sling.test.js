const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");

const src = fs.readFileSync(path.join(__dirname, "setup-sling.js"), "utf8");

test("self-host writes MONGODB_URL and a Gemini key, not MONGO_URI", () => {
  assert.match(src, /apiEnvConfig\.MONGODB_URL/);
  assert.match(src, /GEMINI_API_KEY/);
  assert.match(src, /GENERATE_DAILY_LIMIT = "0"/);
  assert.doesNotMatch(src, /apiEnvConfig\.MONGO_URI\s*=/);
});

test("self-host starts API and Studio together, not the storefront first", () => {
  assert.match(src, /startInBackground/);
  assert.match(src, /waitForPort\(2021\)/);
  assert.match(src, /waitUntilStopped/);
  const selfHost = src.slice(src.indexOf("const setupSelfHostedDashboard"));
  assert.match(selfHost, /startInBackground\([\s\S]*sling-api/);
  assert.match(selfHost, /startInBackground\([\s\S]*sling-studio/);
  assert.doesNotMatch(selfHost, /await runCommand\("yarn", \["run", "dev"\]/);
});

test("does not clone sling-ai", () => {
  assert.doesNotMatch(src, /sling-ai/);
});

test("self-host ensures Mongo before clone", () => {
  const selfHost = src.slice(src.indexOf("const setupSelfHostedDashboard"));
  assert.match(selfHost, /ensureMongo/);
  assert.match(src, /mongo-bootstrap/);
});

test("self-host installer parses (no duplicate spinner)", () => {
  require("child_process").execFileSync(process.execPath, [
    "--check",
    path.join(__dirname, "setup-sling.js"),
  ]);
});

test("self-host auto-picks one company and does not require a key paste first", () => {
  const selfHost = src.slice(src.indexOf("const setupSelfHostedDashboard"));
  assert.match(src, /STOREFRONT_AUTO_TENANT = "1"/);
  assert.match(selfHost, /NEXT_PUBLIC_CLIENT_KEY_SECRET = ""/);
  assert.match(selfHost, /NEXT_PUBLIC_CLIENT_ID = ""/);
});

test("after start, tells people Studio, API, and the storefront", () => {
  assert.match(src, /printRunningNextSteps/);
  const ui = fs.readFileSync(path.join(__dirname, "installUi.js"), "utf8");
  assert.match(ui, /Sign up at/);
  assert.match(ui, /localhost:2021/);
  assert.match(ui, /API at/);
  assert.match(ui, /localhost:10001/);
  assert.match(ui, /Preview Studio changes at/);
  assert.match(ui, /localhost:4087/);
});

test("install hides yarn noise and shows sling.biz progress", () => {
  assert.match(src, /runQuiet/);
  assert.match(src, /--silent/);
  assert.doesNotMatch(src, /stdio: "inherit"[\s\S]*yarn", \["install"/);
  assert.match(src, /printBanner/);
  assert.match(src, /Installing Studio packages/);
  assert.doesNotMatch(src, /Installing dependencies in \$\{projectPath\}/);
});
