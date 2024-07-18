#!/usr/bin/env node

const inquirer = require("inquirer");
const simpleGit = require("simple-git");
const fs = require("fs-extra");
const path = require("path");
const { spawn } = require("child_process");
const dotenv = require("dotenv");
const chalk = require("chalk");
const { exec } = require("child_process");

const FE_REPO_URL = "https://github.com/slingbiz/sling-fe.git";
const API_REPO_URL = "https://github.com/slingbiz/sling-api.git";
const STUDIO_REPO_URL = "https://github.com/slingbiz/sling-studio.git";

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
  },
];

const HOSTED_QUESTIONS = [
  {
    name: "clientKeySecret",
    type: "input",
    message: `${chalk.blue.bold(
      "Enter your NEXT_PUBLIC_CLIENT_KEY_SECRET (You can get this key after successful signup on"
    )} ${chalk.underline.blue("studio.sling.biz")} ${chalk.blue.bold(
      "and get the key from company settings.\nYou can also skip it and update it later in the .env):"
    )}\n`,
    default: "",
  },
  {
    name: "clientId",
    type: "input",
    message: chalk.blue.bold(
      "\nEnter your NEXT_PUBLIC_CLIENT_ID (For example, your@email.com):\n"
    ),
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
];

const createProject = async () => {
  const answers = await inquirer.prompt(QUESTIONS);

  const projectPath = path.join(process.cwd(), answers.projectName);
  const git = simpleGit();

  try {
    console.log("Creating project directory...");
    await fs.mkdir(projectPath);

    if (answers.solutionType === "Hosted Solution") {
      await setupHostedSolution(projectPath, git);
    } else {
      await setupSelfHostedDashboard(projectPath, git);
    }

    console.log("Project setup is complete!");
  } catch (error) {
    console.error("Error setting up the project:", error);
  }
};

const setupHostedSolution = async (projectPath, git) => {
  const answers = await inquirer.prompt(HOSTED_QUESTIONS);

  console.log("Cloning the sling-fe repository...");
  await git.clone(FE_REPO_URL, path.join(projectPath, "sling-fe"));

  const feEnvPath = path.join(projectPath, "sling-fe", ".env.sample");
  const finalEnvPath = path.join(projectPath, "sling-fe", ".env");

  const envConfig = dotenv.parse(fs.readFileSync(feEnvPath));
  envConfig.NEXT_PUBLIC_CLIENT_KEY_SECRET = answers.clientKeySecret;
  envConfig.NEXT_PUBLIC_CLIENT_ID = answers.clientId;
  delete envConfig.NEXT_PUBLIC_API_URL;

  const envFileContent = Object.entries(envConfig)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  fs.writeFileSync(finalEnvPath, envFileContent);
  console.log(`.env file created at ${finalEnvPath}`);

  console.log("Installing dependencies...");
  await installDependencies(path.join(projectPath, "sling-fe"));

  console.log("Starting the sling-fe service...");
  await runCommand("yarn", ["run", "dev"], path.join(projectPath, "sling-fe"));

  console.log(
    `Open ${chalk.underline.blue("http://localhost:4087")} in your browser.`
  );
};

const setupSelfHostedDashboard = async (projectPath, git) => {
  const answers = await inquirer.prompt(SELF_HOSTED_QUESTIONS);

  console.log("Cloning the sling-fe repository...");
  await git.clone(FE_REPO_URL, path.join(projectPath, "sling-fe"));

  console.log("Cloning the sling-api repository...");
  await git.clone(API_REPO_URL, path.join(projectPath, "sling-api"));

  console.log("Cloning the sling-studio repository...");
  await git.clone(STUDIO_REPO_URL, path.join(projectPath, "sling-studio"));

  const feEnvPath = path.join(projectPath, "sling-fe", ".env.example");
  const finalFeEnvPath = path.join(projectPath, "sling-fe", ".env");

  const apiEnvPath = path.join(projectPath, "sling-api", ".env.sample");
  const finalApiEnvPath = path.join(projectPath, "sling-api", ".env");

  const studioEnvPath = path.join(projectPath, "sling-studio", ".env.example");
  const finalStudioEnvPath = path.join(projectPath, "sling-studio", ".env");

  const feEnvConfig = dotenv.parse(fs.readFileSync(feEnvPath));
  const apiEnvConfig = dotenv.parse(fs.readFileSync(apiEnvPath));
  const studioEnvConfig = dotenv.parse(fs.readFileSync(studioEnvPath));

  apiEnvConfig.MONGO_URI = answers.mongoUri;

  const writeEnvFile = (envConfig, outputPath) => {
    const envFileContent = Object.entries(envConfig)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");
    fs.writeFileSync(outputPath, envFileContent);
    console.log(`.env file created at ${outputPath}`);
  };

  writeEnvFile(feEnvConfig, finalFeEnvPath);
  writeEnvFile(apiEnvConfig, finalApiEnvPath);
  writeEnvFile(studioEnvConfig, finalStudioEnvPath);

  console.log("Installing dependencies...");
  await installDependencies(path.join(projectPath, "sling-fe"));
  await installDependencies(path.join(projectPath, "sling-api"));
  await installDependencies(path.join(projectPath, "sling-studio"));

  console.log("Starting all services...");
  runCommand("yarn", ["run", "dev"], path.join(projectPath, "sling-fe"));
  runCommand("yarn", ["run", "dev"], path.join(projectPath, "sling-api"));
  runCommand("yarn", ["run", "dev"], path.join(projectPath, "sling-studio"));

  console.log(
    `Open ${chalk.underline.blue(
      "http://localhost:4087"
    )} in your browser for the frontend. Open ${chalk.underline.blue(
      "http://localhost:2021"
    )} for the studio.`
  );
  console.log(
    `Once you sign up and finish the company setup, copy the client key from the studio to sling-fe's .env as ${chalk.bold(
      "NEXT_PUBLIC_CLIENT_KEY_SECRET"
    )} and your email as ${chalk.bold("NEXT_PUBLIC_CLIENT_ID")}.`
  );
};

const runCommand = (command, args, cwd) => {
  return new Promise((resolve, reject) => {
    const cmd = spawn(command, args, { cwd, stdio: "inherit" });

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

const installDependencies = async (projectPath) => {
  try {
    console.log(`Running 'yarn install' in ${projectPath}`);
    await runCommand("yarn", ["install"], projectPath);
  } catch (error) {
    console.error(error);
    throw error;
  }
};

createProject();
