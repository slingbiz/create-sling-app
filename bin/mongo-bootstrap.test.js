const test = require("node:test");
const assert = require("node:assert/strict");
const {
  parseMongoTarget,
  isLocalMongoUri,
  missingMongoMessage,
  ensureMongo,
} = require("./mongo-bootstrap");

test("treats localhost Mongo as local and Atlas as not", () => {
  assert.equal(isLocalMongoUri("mongodb://localhost:27017/sling"), true);
  assert.equal(isLocalMongoUri("mongodb://127.0.0.1:27017/sling"), true);
  assert.equal(
    isLocalMongoUri("mongodb+srv://user:pass@cluster.mongodb.net/sling"),
    false
  );
  assert.deepEqual(parseMongoTarget("mongodb://localhost:27017/sling"), {
    host: "localhost",
    port: 27017,
    srv: false,
    local: true,
  });
});

test("no-Docker message points at Docker Desktop, local Mongo, or Atlas", () => {
  const msg = missingMongoMessage();
  assert.match(msg, /Docker Desktop/);
  assert.match(msg, /Atlas/);
  assert.match(msg, /install MongoDB locally/i);
});

test("starts Docker Mongo when local URI is down and Docker is available", async () => {
  let started = false;
  const result = await ensureMongo("mongodb://localhost:27017/sling", {
    canReachPort: async () => false,
    dockerAvailable: () => true,
    startDockerMongo: () => {
      started = true;
    },
    waitForLocalMongo: async () => {},
  });
  assert.equal(started, true);
  assert.equal(result.startedDocker, true);
});

test("stops with the no-Docker message when local Mongo is down", async () => {
  await assert.rejects(
    () =>
      ensureMongo("mongodb://localhost:27017/sling", {
        canReachPort: async () => false,
        dockerAvailable: () => false,
      }),
    /Docker Desktop/
  );
});

test("does not start Docker for a remote Atlas-style URI", async () => {
  let started = false;
  await assert.rejects(
    () =>
      ensureMongo("mongodb://cluster.mongodb.net:27017/sling", {
        canReachPort: async () => false,
        dockerAvailable: () => true,
        startDockerMongo: () => {
          started = true;
        },
      }),
    /Could not reach MongoDB/
  );
  assert.equal(started, false);
});
