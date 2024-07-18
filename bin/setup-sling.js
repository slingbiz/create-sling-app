#!/usr/bin/env node

const inquirer = require("inquirer");
const simpleGit = require("simple-git");
const fs = require("fs-extra");
const path = require("path");
const { spawn } = require("child_process");
const dotenv = require("dotenv");
const ora = require("ora");
const colors = require("colors");

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
];

const createProject = async () => {
  console.log("\nWelcome to the Sling Project Setup!".bold.green);
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
  await git.clone(FE_REPO_URL, path.join(projectPath, "sling-fe"));

  const feEnvPath = path.join(projectPath, "sling-fe", ".env.example");
  const finalEnvPath = path.join(projectPath, "sling-fe", ".env");

  const envConfig = dotenv.parse(fs.readFileSync(feEnvPath));
  envConfig.NEXT_PUBLIC_CLIENT_KEY_SECRET = answers.clientKeySecret;
  envConfig.NEXT_PUBLIC_CLIENT_ID = answers.clientId;
  delete envConfig.NEXT_PUBLIC_API_URL;

  const envFileContent = Object.entries(envConfig)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  fs.writeFileSync(finalEnvPath, envFileContent);
  console.log(`\n.env file created at ${finalEnvPath}`.blue);

  const spinner = ora("Installing dependencies...").start();
  try {
    await installDependencies(path.join(projectPath, "sling-fe"));
    spinner.succeed("Dependencies installed successfully.".green);
  } catch (error) {
    spinner.fail("Error installing dependencies.".red);
    throw error;
  }

  console.log("\nStarting the sling-fe service...".cyan);
  await runCommandInBackground(
    "yarn",
    ["run", "dev"],
    path.join(projectPath, "sling-fe")
  );

  console.log(
    `\nOpen ${"http://localhost:4087".underline.blue} in your browser.\n`
  );
};

const setupSelfHostedDashboard = async (projectPath, git) => {
  const answers = await inquirer.prompt(SELF_HOSTED_QUESTIONS);

  console.log("\nCloning the sling-fe repository...".cyan);
  await git.clone(FE_REPO_URL, path.join(projectPath, "sling-fe"));

  console.log("\nCloning the sling-api repository...".cyan);
  await git.clone(API_REPO_URL, path.join(projectPath, "sling-api"));

  console.log("\nCloning the sling-studio repository...".cyan);
  await git.clone(STUDIO_REPO_URL, path.join(projectPath, "sling-studio"));

  const feEnvPath = path.join(projectPath, "sling-fe", ".env.example");
  const finalFeEnvPath = path.join(projectPath, "sling-fe", ".env");

  const apiEnvPath = path.join(projectPath, "sling-api", ".env.example");
  const finalApiEnvPath = path.join(projectPath, "sling-api", ".env");

  const studioEnvPath = path.join(projectPath, "sling-studio", ".env.sample");
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
    console.log(`\n.env file created at ${outputPath}`.blue);
  };

  writeEnvFile(feEnvConfig, finalFeEnvPath);
  writeEnvFile(apiEnvConfig, finalApiEnvPath);
  writeEnvFile(studioEnvConfig, finalStudioEnvPath);

  const spinner = ora("Installing dependencies...").start();
  try {
    await installDependencies(path.join(projectPath, "sling-fe"));
    await installDependencies(path.join(projectPath, "sling-api"));
    await installDependencies(path.join(projectPath, "sling-studio"));
    spinner.succeed("Dependencies installed successfully.".green);
  } catch (error) {
    spinner.fail("Error installing dependencies.".red);
    throw error;
  }

  console.log("\nStarting all services...".cyan);
  try {
    await runCommandInBackground(
      "yarn",
      ["run", "dev"],
      path.join(projectPath, "sling-fe")
    );
    await runCommandInBackground(
      "yarn",
      ["run", "dev"],
      path.join(projectPath, "sling-api")
    );
    await runCommandInBackground(
      "yarn",
      ["run", "dev"],
      path.join(projectPath, "sling-studio")
    );
  } catch (error) {
    console.error("Error starting services:".red, error);
  }

  console.log(
    `\nOpen ${
      "http://localhost:4087".underline.blue
    } in your browser for the frontend.\nOpen ${
      "http://localhost:2021".underline.blue
    } for the studio.\n`
  );
  console.log(
    `Once you sign up and finish the company setup, copy the client key from the studio to sling-fe's .env as ${
      "NEXT_PUBLIC_CLIENT_KEY_SECRET".bold
    } and your email as ${"NEXT_PUBLIC_CLIENT_ID".bold}.\n`
  );
};

const runCommandInBackground = (command, args, cwd) => {
  return new Promise((resolve, reject) => {
    const cmd = spawn(command, args, {
      cwd,
      detached: true,
      stdio: "ignore",
    });

    cmd.on("error", (error) => {
      reject(error);
    });

    cmd.unref();
    resolve();
  });
};

const runCommand = (command, args, cwd, showOutput = true) => {
  return new Promise((resolve, reject) => {
    const cmd = spawn(command, args, {
      cwd,
      stdio: showOutput ? "inherit" : "pipe",
    });

    let errorOutput = "";

    if (cmd.stderr) {
      cmd.stderr.on("data", (data) => {
        errorOutput += data.toString();
      });
    }

    cmd.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `${command} ${args.join(
              " "
            )} failed with code ${code}\n${errorOutput}`
          )
        );
        return;
      }
      resolve();
    });
  });
};

const installDependencies = async (projectPath) => {
  try {
    console.log(`\nInstalling dependencies in ${projectPath}`.yellow);
    await runCommand("yarn", ["install"], projectPath, true); // Don't show output
  } catch (error) {
    console.error("Error installing dependencies:".red, error);
    throw error;
  }
};

createProject();
