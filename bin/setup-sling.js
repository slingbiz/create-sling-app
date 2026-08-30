#!/usr/bin/env node

const inquirer = require("inquirer");
const simpleGit = require("simple-git");
const fs = require("fs-extra");
const path = require("path");
const net = require("net");
const { spawn } = require("child_process");
const https = require("https");
const os = require("os");
const dotenv = require("dotenv");
const { ensureMongo } = require("./mongo-bootstrap");
const {
  printBanner,
  startProgress,
  printRunningNextSteps,
  printHostedNextSteps,
} = require("./installUi");
const colors = require("colors");

const FE_REPO_URL = "https://github.com/slingbiz/sling-fe.git";
const API_REPO_URL = "https://github.com/slingbiz/sling-api.git";
const STUDIO_REPO_URL = "https://github.com/slingbiz/sling-studio.git";
const METRICS_API_URL = "https://api.sling.biz/v1/metrics";

const INSTALL_ENV = {
  ...process.env,
  HUSKY: "0",
  HUSKY_SKIP_INSTALL: "1",
  npm_config_loglevel: "error",
};

const QUESTIONS = [
  {
    name: "solutionType",
    type: "list",
    message: "Hosted Studio, or Studio on this machine?",
    choices: [
      { name: "Hosted — studio.sling.biz", value: "Hosted Solution" },
      { name: "Self-hosted — run everything locally", value: "Self-hosted Dashboard" },
    ],
  },
  {
    name: "projectName",
    type: "input",
    message: "Enter the name of your project:",
    default: "sling-project",
    validate: function (input) {
      if (/^([A-Za-z\-\_\d])+$/.test(input)) return true;
      else
        return "Project name may only include letters, numbers, underscores, and hashes."
          .red;
    },
  },
];

const HOSTED_QUESTIONS = [
  {
    name: "clientKeySecret",
    type: "input",
    message:
      "Company key from Settings → Keys. Skip if you have not signed up yet:",
    default: "",
  },
  {
    name: "clientId",
    type: "input",
    message: "Company email from Settings → Keys. Skip if you have not signed up yet:",
    default: "",
  },
];

const SELF_HOSTED_QUESTIONS = [
  {
    name: "mongoUri",
    type: "input",
    message: "Enter your MongoDB URI:",
    default: "mongodb://localhost:27017/sling",
  },
  {
    name: "geminiKey",
    type: "input",
    message:
      "Enter your GEMINI_API_KEY (aistudio.google.com/apikey). Skip to add it later — Create will not generate without it:",
    default: "",
  },
];

const removeGitFolder = async (projectPath) => {
  const gitFolderPath = path.join(projectPath, ".git");
  if (fs.existsSync(gitFolderPath)) {
    await fs.remove(gitFolderPath);
  }
};

const writeEnvFile = (envConfig, outputPath) => {
  const envFileContent = Object.entries(envConfig)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  fs.writeFileSync(outputPath, envFileContent);
};

const sendMetrics = (projectName, solutionType) => {
  const body = JSON.stringify({
    osType: os.type(),
    osPlatform: os.platform(),
    osRelease: os.release(),
    cpuArch: os.arch(),
    cpuCores: os.cpus().length,
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    nodeVersion: process.version,
    projectName,
    solutionType,
  });
  const url = new URL(METRICS_API_URL);
  const req = https.request(
    {
      hostname: url.hostname,
      path: url.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    },
    () => {},
  );
  req.on("error", () => {});
  req.end(body);
};

const createProject = async () => {
  printBanner();

  const answers = await inquirer.prompt(QUESTIONS);
  sendMetrics(answers.projectName, answers.solutionType);

  const projectPath = path.join(process.cwd(), answers.projectName);
  const git = simpleGit();

  try {
    await fs.mkdir(projectPath);

    if (answers.solutionType === "Hosted Solution") {
      await setupHostedSolution(projectPath, git);
    } else {
      await setupSelfHostedDashboard(projectPath, git);
    }
  } catch (error) {
    console.error(colors.red(error.message || error));
  }
};

const setupHostedSolution = async (projectPath, git) => {
  const answers = await inquirer.prompt(HOSTED_QUESTIONS);
  const progress = startProgress();

  try {
  progress.hint("Downloading the storefront");
  await git.clone(FE_REPO_URL, path.join(projectPath, "sling-fe"), [
    "--depth",
    "1",
    "--quiet",
  ]);
  await removeGitFolder(path.join(projectPath, "sling-fe"));

  const feEnvPath = path.join(projectPath, "sling-fe", ".env.example");
  const finalEnvPath = path.join(projectPath, "sling-fe", ".env");

  const envConfig = dotenv.parse(fs.readFileSync(feEnvPath));
  envConfig.NEXT_PUBLIC_CLIENT_KEY_SECRET = answers.clientKeySecret;
  envConfig.NEXT_PUBLIC_CLIENT_ID = answers.clientId;
  delete envConfig.NEXT_PUBLIC_API_URL;

  progress.hint("Writing local config");
  writeEnvFile(envConfig, finalEnvPath);

  progress.hint("Installing storefront packages — this can take a few minutes");
  await installDependencies(path.join(projectPath, "sling-fe"));
  progress.succeed("Storefront is ready.");
  } catch (error) {
    progress.fail("Setup stopped.");
    throw error;
  }

  const logDir = path.join(projectPath, ".sling-logs");
  await fs.ensureDir(logDir);
  const boot = startProgress();
  boot.hint("Starting the storefront");

  const children = [
    startInBackground(
      "yarn",
      ["run", "dev"],
      path.join(projectPath, "sling-fe"),
      path.join(logDir, "storefront.log")
    ),
  ];

  try {
    await waitForPort(4087);
    boot.succeed("The storefront is running.");
  } catch (error) {
    boot.fail("Could not start. Check .sling-logs in the project folder.");
    throw error;
  }

  printHostedNextSteps({
    keysMissing: !answers.clientKeySecret || !answers.clientId,
  });
  await waitUntilStopped(children);
};

const setupSelfHostedDashboard = async (projectPath, git) => {
  const answers = await inquirer.prompt(SELF_HOSTED_QUESTIONS);
  const progress = startProgress();

  try {
  progress.hint("Checking MongoDB");
    const mongo = await ensureMongo(answers.mongoUri);
    answers.mongoUri = mongo.uri;

  progress.hint("Downloading the storefront");
  await git.clone(FE_REPO_URL, path.join(projectPath, "sling-fe"), [
    "--depth",
    "1",
    "--quiet",
  ]);

  progress.hint("Downloading the API");
  await git.clone(API_REPO_URL, path.join(projectPath, "sling-api"), [
    "--depth",
    "1",
    "--quiet",
  ]);

  progress.hint("Downloading Studio");
  await git.clone(STUDIO_REPO_URL, path.join(projectPath, "sling-studio"), [
    "--depth",
    "1",
    "--quiet",
  ]);

  const feEnvPath = path.join(projectPath, "sling-fe", ".env.example");
  const finalFeEnvPath = path.join(projectPath, "sling-fe", ".env");

  const apiEnvPath = path.join(projectPath, "sling-api", ".env.example");
  const finalApiEnvPath = path.join(projectPath, "sling-api", ".env");

  const studioEnvPath = path.join(projectPath, "sling-studio", ".env.sample");
  const finalStudioEnvPath = path.join(projectPath, "sling-studio", ".env");

  const feEnvConfig = dotenv.parse(fs.readFileSync(feEnvPath));
  const apiEnvConfig = dotenv.parse(fs.readFileSync(apiEnvPath));
  const studioEnvConfig = dotenv.parse(fs.readFileSync(studioEnvPath));

  apiEnvConfig.NODE_ENV = "development";
  apiEnvConfig.MONGODB_URL = answers.mongoUri;
  delete apiEnvConfig.MONGO_URI;
  apiEnvConfig.GEMINI_API_KEY = answers.geminiKey || "";
  apiEnvConfig.GENERATE_DAILY_LIMIT = "0";
  apiEnvConfig.STOREFRONT_AUTO_TENANT = "1";
  delete apiEnvConfig.GENERATE_ONLY;

  feEnvConfig.NEXT_PUBLIC_CLIENT_KEY_SECRET = "";
  feEnvConfig.NEXT_PUBLIC_CLIENT_ID = "";
  feEnvConfig.NEXT_PUBLIC_API_URL = "http://localhost:10001";

  progress.hint("Writing local config");
  writeEnvFile(feEnvConfig, finalFeEnvPath);
  writeEnvFile(apiEnvConfig, finalApiEnvPath);
  writeEnvFile(studioEnvConfig, finalStudioEnvPath);

  progress.hint("Installing storefront packages — this can take a few minutes");
  await installDependencies(path.join(projectPath, "sling-fe"));
  progress.hint("Installing API packages");
  await installDependencies(path.join(projectPath, "sling-api"));
  progress.hint("Installing Studio packages — usually the longest step");
  await installDependencies(path.join(projectPath, "sling-studio"));

  await removeGitFolder(path.join(projectPath, "sling-fe"));
  await removeGitFolder(path.join(projectPath, "sling-api"));
  await removeGitFolder(path.join(projectPath, "sling-studio"));

  progress.succeed("Install finished.");
  } catch (error) {
    progress.fail("Setup stopped.");
    throw error;
  }

  const logDir = path.join(projectPath, ".sling-logs");
  await fs.ensureDir(logDir);
  const boot = startProgress();
  boot.hint("Starting Studio, the API, and the storefront");

  const children = [
    startInBackground(
      "yarn",
      ["run", "dev"],
      path.join(projectPath, "sling-api"),
      path.join(logDir, "api.log")
    ),
    startInBackground(
      "yarn",
      ["run", "dev"],
      path.join(projectPath, "sling-studio"),
      path.join(logDir, "studio.log")
    ),
    startInBackground(
      "yarn",
      ["run", "dev"],
      path.join(projectPath, "sling-fe"),
      path.join(logDir, "storefront.log")
    ),
  ];

  try {
    await waitForPort(10001);
    await waitForPort(2021);
    await waitForPort(4087);
    boot.succeed("Studio, the API, and the storefront are running.");
  } catch (error) {
    boot.fail("Could not start. Check .sling-logs in the project folder.");
    throw error;
  }

  printRunningNextSteps({ geminiMissing: !answers.geminiKey });
  await waitUntilStopped(children);
};

const runCommand = (command, args, cwd) => {
  return new Promise((resolve, reject) => {
    const cmd = spawn(command, args, {
      cwd,
      stdio: "inherit",
      env: INSTALL_ENV,
      shell: process.platform === "win32",
    });

    cmd.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(`${command} ${args.join(" ")} failed with code ${code}`)
        );
        return;
      }
      resolve();
    });
  });
};

const runQuiet = (command, args, cwd) => {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const cmd = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: INSTALL_ENV,
      shell: process.platform === "win32",
    });

    const collect = (data) => {
      chunks.push(data);
      if (chunks.length > 80) {
        chunks.shift();
      }
    };
    cmd.stdout.on("data", collect);
    cmd.stderr.on("data", collect);

    cmd.on("close", (code) => {
      if (code !== 0) {
        const tail = Buffer.concat(chunks)
          .toString()
          .trim()
          .split("\n")
          .slice(-20)
          .join("\n");
        reject(
          new Error(
            tail || `${command} ${args.join(" ")} failed with code ${code}`
          )
        );
        return;
      }
      resolve();
    });
  });
};

const startInBackground = (command, args, cwd, logFile) => {
  const out = logFile
    ? fs.openSync(logFile, "a")
    : "ignore";
  return spawn(command, args, {
    cwd,
    stdio: ["ignore", out, out],
    env: INSTALL_ENV,
    shell: process.platform === "win32",
  });
};

const waitForPort = (port, timeoutMs = 90000) =>
  new Promise((resolve, reject) => {
    const started = Date.now();
    const tryOnce = () => {
      const socket = net.connect({ port, host: "127.0.0.1" }, () => {
        socket.end();
        resolve();
      });
      socket.on("error", () => {
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`Nothing is listening on localhost:${port}`));
          return;
        }
        setTimeout(tryOnce, 400);
      });
    };
    tryOnce();
  });

const waitUntilStopped = (children) =>
  new Promise(() => {
    const stop = () => {
      children.forEach((child) => {
        if (child && !child.killed) {
          child.kill("SIGINT");
        }
      });
      process.exit(0);
    };
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
  });

const installDependencies = async (projectPath) => {
  await runQuiet(
    "yarn",
    ["install", "--silent", "--no-progress", "--non-interactive"],
    projectPath
  );
};

createProject();
