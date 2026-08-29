#!/usr/bin/env node

const inquirer = require("inquirer");
const simpleGit = require("simple-git");
const fs = require("fs-extra");
const path = require("path");
const { spawn } = require("child_process");
const dotenv = require("dotenv");
const { ensureMongo } = require("./mongo-bootstrap");
const ora = require("ora");
const colors = require("colors");

const FE_REPO_URL = "https://github.com/slingbiz/sling-fe.git";
const API_REPO_URL = "https://github.com/slingbiz/sling-api.git";
const STUDIO_REPO_URL = "https://github.com/slingbiz/sling-studio.git";

const INSTALL_ENV = {
  ...process.env,
  HUSKY: "0",
  HUSKY_SKIP_INSTALL: "1",
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
  console.log(`\n.env file created at ${outputPath}`.blue);
};

const createProject = async () => {
  console.log("\nWelcome to the Sling CMS Project Setup!".bold.green);
  console.log("Let's get started...\n".bold);

  const answers = await inquirer.prompt(QUESTIONS);

  const projectPath = path.join(process.cwd(), answers.projectName);
  const git = simpleGit();

  try {
    console.log("\nCreating project directory...".bold);
    await fs.mkdir(projectPath);

    if (answers.solutionType === "Hosted Solution") {
      await setupHostedSolution(projectPath, git);
    } else {
      await setupSelfHostedDashboard(projectPath, git);
    }

    console.log("\nProject setup is complete!".green.bold);
  } catch (error) {
    console.error("\nError setting up the project:".red, error);
  }
};

const setupHostedSolution = async (projectPath, git) => {
  const answers = await inquirer.prompt(HOSTED_QUESTIONS);

  console.log("\nCloning the sling-fe repository...".cyan);
  await git.clone(FE_REPO_URL, path.join(projectPath, "sling-fe"), [
    "--depth",
    "1",
  ]);
  await removeGitFolder(path.join(projectPath, "sling-fe"));

  const feEnvPath = path.join(projectPath, "sling-fe", ".env.example");
  const finalEnvPath = path.join(projectPath, "sling-fe", ".env");

  const envConfig = dotenv.parse(fs.readFileSync(feEnvPath));
  envConfig.NEXT_PUBLIC_CLIENT_KEY_SECRET = answers.clientKeySecret;
  envConfig.NEXT_PUBLIC_CLIENT_ID = answers.clientId;
  delete envConfig.NEXT_PUBLIC_API_URL;

  writeEnvFile(envConfig, finalEnvPath);

  const spinner = ora("Installing dependencies...").start();
  try {
    await installDependencies(path.join(projectPath, "sling-fe"));
    spinner.succeed("Dependencies installed successfully.".green);
  } catch (error) {
    spinner.fail("Error installing dependencies.".red);
    throw error;
  }

  console.log(
    `\nCreate pages in hosted Studio: ${
      "https://studio.sling.biz/create".underline.blue
    }`
  );
  console.log(
    `Storefront (after keys): ${"http://localhost:4087".underline.blue}\n`
  );

  console.log(
    "\nStarting the sling-fe service (Press Ctrl + C to stop)...".cyan
  );
  await runCommand("yarn", ["run", "dev"], path.join(projectPath, "sling-fe"));
};

const setupSelfHostedDashboard = async (projectPath, git) => {
  const answers = await inquirer.prompt(SELF_HOSTED_QUESTIONS);

  const spinner = ora("Checking MongoDB...").start();
  try {
    const mongo = await ensureMongo(answers.mongoUri);
    answers.mongoUri = mongo.uri;
    if (mongo.startedDocker) {
      spinner.succeed("Started MongoDB in Docker on localhost:27017.".green);
    } else {
      spinner.succeed("MongoDB is reachable.".green);
    }
  } catch (error) {
    spinner.fail("MongoDB is not ready.".red);
    console.error(`\n${error.message}`.red);
    throw error;
  }

  console.log("\nCloning the sling-fe repository...".cyan);
  await git.clone(FE_REPO_URL, path.join(projectPath, "sling-fe"), [
    "--depth",
    "1",
  ]);

  console.log("\nCloning the sling-api repository...".cyan);
  await git.clone(API_REPO_URL, path.join(projectPath, "sling-api"), [
    "--depth",
    "1",
  ]);

  console.log("\nCloning the sling-studio repository...".cyan);
  await git.clone(STUDIO_REPO_URL, path.join(projectPath, "sling-studio"), [
    "--depth",
    "1",
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

  writeEnvFile(feEnvConfig, finalFeEnvPath);
  writeEnvFile(apiEnvConfig, finalApiEnvPath);
  writeEnvFile(studioEnvConfig, finalStudioEnvPath);

  const installSpinner = ora("Installing dependencies...").start();
  try {
    await installDependencies(path.join(projectPath, "sling-fe"));
    await installDependencies(path.join(projectPath, "sling-api"));
    await installDependencies(path.join(projectPath, "sling-studio"));
    installSpinner.succeed("Dependencies installed successfully.".green);

    console.log("\nRemoving .git folders...".cyan);
    await removeGitFolder(path.join(projectPath, "sling-fe"));
    await removeGitFolder(path.join(projectPath, "sling-api"));
    await removeGitFolder(path.join(projectPath, "sling-studio"));
    console.log(".git folders removed.".green);
  } catch (error) {
    installSpinner.fail("Error installing dependencies.".red);
    throw error;
  }

  console.log(
    `\nCreate pages in Studio: ${
      "http://localhost:2021/create".underline.blue
    }`
  );
  console.log(`API: ${"http://localhost:10001".underline.blue}`);
  console.log(`Storefront: ${"http://localhost:4087".underline.blue}\n`);
  if (!answers.geminiKey) {
    console.log(
      "No Gemini key yet. Add GEMINI_API_KEY to sling-api/.env before Create will generate.\n"
        .yellow
    );
  }
  console.log(
    "Sign up in Studio, then open the storefront. One company is picked automatically.\n"
      .cyan
  );
  console.log(
    `A second company is a choice: paste that company’s key from Studio ${
      "Settings → Keys".bold
    } into sling-fe/.env, then restart the storefront.\n`
  );

  console.log(
    "Starting API, Studio, and the storefront together (Ctrl + C stops all)...\n"
      .cyan
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
  try {
    console.log(`\nInstalling dependencies in ${projectPath}`.yellow);
    await runCommand("yarn", ["install"], projectPath);
  } catch (error) {
    console.error("Error installing dependencies:".red, error);
    throw error;
  }
};

createProject();
