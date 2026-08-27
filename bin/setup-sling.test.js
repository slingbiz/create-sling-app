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
  assert.match(src, /localhost:2021\/create/);
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
