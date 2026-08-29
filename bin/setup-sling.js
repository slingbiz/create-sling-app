#!/usr/bin/env node

const inquirer = require("inquirer");
const simpleGit = require("simple-git");
const fs = require("fs-extra");
const path = require("path");
const { spawn } = require("child_process");
const https = require("https");
const os = require("os");
const dotenv = require("dotenv");
const { ensureMongo } = require("./mongo-bootstrap");
const { printBanner, startProgress } = require("./installUi");
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
    message: "Do you want a hosted solution or self-hosted dashboard?",
    choices: ["Hosted Solution", "Self-hosted Dashboard"],
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
    message: `
Enter your NEXT_PUBLIC_CLIENT_KEY_SECRET (You can get this key after successful signup on studio.sling.biz and get the key from company settings.
You can also skip it and update it later in the .env):\n`,
    default: "",
  },
  {
    name: "clientId",
    type: "input",
    message:
      "\nEnter your NEXT_PUBLIC_CLIENT_ID (For example, your@email.com):\n",
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

  console.log(
    `  Create pages in hosted Studio: ${
      "https://studio.sling.biz/create".underline.blue
    }`
  );
  console.log(
    `  Storefront (after keys): ${"http://localhost:4087".underline.blue}\n`
  );

  console.log("  Starting the storefront (Ctrl + C to stop)…\n".cyan);
  await runCommand("yarn", ["run", "dev"], path.join(projectPath, "sling-fe"));
  } catch (error) {
    progress.fail("Setup stopped.");
    throw error;
  }
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

  console.log(
    `  Create pages in Studio: ${
      "http://localhost:2021/create".underline.blue
    }`
  );
  console.log(`  API: ${"http://localhost:10001".underline.blue}`);
  console.log(`  Storefront: ${"http://localhost:4087".underline.blue}\n`);
  if (!answers.geminiKey) {
    console.log(
      "  No Gemini key yet. Add GEMINI_API_KEY to sling-api/.env before Create will generate.\n"
        .yellow
    );
  }
  console.log(
    "  Sign up in Studio, then open the storefront. One company is picked automatically.\n"
      .cyan
  );
  console.log(
    `  A second company is a choice: paste that company’s key from Studio ${
      "Settings → Keys".bold
    } into sling-fe/.env, then restart the storefront.\n`
  );

  console.log(
    "  Starting API, Studio, and the storefront (Ctrl + C stops all)…\n".cyan
  );

  const children = [
    startInBackground(
      "yarn",
      ["run", "dev"],
      path.join(projectPath, "sling-api")
    ),
    startInBackground(
      "yarn",
      ["run", "dev"],
      path.join(projectPath, "sling-studio")
    ),
    startInBackground(
      "yarn",
      ["run", "dev"],
      path.join(projectPath, "sling-fe")
    ),
  ];
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

const startInBackground = (command, args, cwd) => {
  return spawn(command, args, {
    cwd,
    stdio: "inherit",
    env: INSTALL_ENV,
    shell: process.platform === "win32",
  });
};

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
