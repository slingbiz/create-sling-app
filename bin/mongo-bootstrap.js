const net = require("net");
const { spawnSync } = require("child_process");

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);
const DOCKER_CONTAINER = "sling-mongo";
const DEFAULT_LOCAL_URI = "mongodb://localhost:27017/sling";

const parseMongoTarget = (uri) => {
  const raw = String(uri || "").trim();
  if (!raw) {
    return { host: "localhost", port: 27017, srv: false, local: true };
  }

  const srv = raw.startsWith("mongodb+srv://");
  const normalized = raw
    .replace(/^mongodb\+srv:\/\//, "https://")
    .replace(/^mongodb:\/\//, "http://");

  try {
    const parsed = new URL(normalized);
    const host = parsed.hostname || "localhost";
    const port = parsed.port ? Number(parsed.port) : 27017;
    return {
      host,
      port,
      srv,
      local: LOCAL_HOSTS.has(host.toLowerCase()),
    };
  } catch (error) {
    return { host: "localhost", port: 27017, srv: false, local: true };
  }
};

const isLocalMongoUri = (uri) => parseMongoTarget(uri).local && !parseMongoTarget(uri).srv;

const missingMongoMessage = () =>
  [
    "Sling CMS needs MongoDB. Nothing to sign up into without it.",
    "Install Docker Desktop and re-run — we will start Mongo for you.",
    "Or install MongoDB locally.",
    "Or paste a free Atlas URI: https://cloud.mongodb.com",
  ].join("\n");

const canReachPort = (host, port, timeoutMs = 2000) =>
  new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (ok) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });

const dockerAvailable = () => {
  const result = spawnSync("docker", ["info"], {
    encoding: "utf8",
    timeout: 8000,
  });
  return result.status === 0;
};

const startDockerMongo = () => {
  const running = spawnSync(
    "docker",
    ["inspect", "-f", "{{.State.Running}}", DOCKER_CONTAINER],
    { encoding: "utf8" }
  );

  if (running.status === 0 && String(running.stdout).trim() === "true") {
    return;
  }

  if (running.status === 0) {
    const started = spawnSync("docker", ["start", DOCKER_CONTAINER], {
      encoding: "utf8",
    });
    if (started.status === 0) return;
  }

  const created = spawnSync(
    "docker",
    [
      "run",
      "-d",
      "--name",
      DOCKER_CONTAINER,
      "-p",
      "27017:27017",
      "--restart",
      "unless-stopped",
      "mongo:7",
    ],
    { encoding: "utf8" }
  );

  if (created.status !== 0) {
    throw new Error(
      created.stderr || created.stdout || "Could not start a MongoDB Docker container."
    );
  }
};

const waitForLocalMongo = async (tries = 20) => {
  for (let i = 0; i < tries; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    if (await canReachPort("127.0.0.1", 27017, 1000)) return;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("MongoDB Docker container started but port 27017 never opened.");
};

const ensureMongo = async (uri, options = {}) => {
  const target = parseMongoTarget(uri);
  const probe = options.canReachPort || canReachPort;
  const reachable = target.srv
    ? true
    : await probe(target.host, target.port);

  if (reachable) {
    return { uri, startedDocker: false };
  }

  if (!target.local) {
    throw new Error(
      `Could not reach MongoDB at ${target.host}:${target.port}. Check the URI, or use Atlas.`
    );
  }

  const hasDocker = options.dockerAvailable
    ? options.dockerAvailable()
    : dockerAvailable();

  if (!hasDocker) {
    throw new Error(missingMongoMessage());
  }

  if (options.startDockerMongo) {
    options.startDockerMongo();
  } else {
    startDockerMongo();
  }

  if (options.waitForLocalMongo) {
    await options.waitForLocalMongo();
  } else {
    await waitForLocalMongo();
  }

  return { uri: uri || DEFAULT_LOCAL_URI, startedDocker: true };
};

module.exports = {
  DEFAULT_LOCAL_URI,
  parseMongoTarget,
  isLocalMongoUri,
  missingMongoMessage,
  canReachPort,
  dockerAvailable,
  ensureMongo,
};
