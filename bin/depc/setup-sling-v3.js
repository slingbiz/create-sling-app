#!/usr/bin/env node

const inquirer = require("inquirer");
const simpleGit = require("simple-git");
const fs = require("fs-extra");
const path = require("path");
const { spawn } = require("child_process");
const dotenv = require("dotenv");
const { exec } = require("child_process");

const FE_REPO_URL = "https://github.com/slingbiz/sling-fe.git";
const API_REPO_URL = "https://github.com/slingbiz/sling-api.git";
const STUDIO_REPO_URL = "https://github.com/slingbiz/sling-studio.git";

const DEFAULTS = {
  projectName: "sling-project",
  mongoUri: "mongodb://localhost:27017/sling",
};

const QUESTIONS = [
  {
    name: "projectName",
    type: "input",
    message: `Enter the name of your project (default: ${DEFAULTS.projectName}):`,
    default: DEFAULTS.projectName,
  },
  {
    name: "mongoUri",
    type: "input",
    message: `Enter your MongoDB URI (default: ${DEFAULTS.mongoUri}):`,
    default: DEFAULTS.mongoUri,
  },
];

const createProject = async () => {
  const answers = await inquirer.prompt(QUESTIONS);

  const projectPath = path.join(process.cwd(), answers.projectName);
  const git = simpleGit();

  try {
    console.log("Creating project directory...");
    await fs.mkdir(projectPath);

    console.log("Cloning the main repository...");
    await git.clone(FE_REPO_URL, path.join(projectPath, "sling-fe"));

    console.log("Cloning the API repository...");
    await git.clone(API_REPO_URL, path.join(projectPath, "sling-api"));

    console.log("Cloning the Studio repository...");
    await git.clone(STUDIO_REPO_URL, path.join(projectPath, "sling-studio"));

    console.log("Installing dependencies for sling-fe...");
    await installDependencies(path.join(projectPath, "sling-fe"));

    console.log("Installing dependencies for sling-api...");
    await installDependencies(path.join(projectPath, "sling-api"));

    console.log("Installing dependencies for sling-studio...");
    await installDependencies(path.join(projectPath, "sling-studio"));

    console.log("Authenticating with Firebase CLI...");
    await authenticateWithFirebase();

    console.log("Listing Firebase projects...");
    const firebaseProjectId = await selectFirebaseProject();

    console.log("Fetching Firebase configuration...");
    const firebaseConfig = await fetchFirebaseConfig(firebaseProjectId);

    console.log("Updating .env files...");
    updateEnvFiles(projectPath, answers, firebaseConfig);

    console.log("Generating README file...");
    generateReadme(projectPath);

    console.log("Project setup is complete!");
  } catch (error) {
    console.error("Error setting up the project:", error);
  }
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

const authenticateWithFirebase = async () => {
  return new Promise((resolve, reject) => {
    exec("firebase login", (error, stdout, stderr) => {
      if (error) {
        reject(`Error authenticating with Firebase: ${stderr}`);
      } else {
        console.log(stdout);
        resolve();
      }
    });
  });
};

const listFirebaseProjects = async () => {
  return new Promise((resolve, reject) => {
    exec("firebase projects:list --json", (error, stdout, stderr) => {
      if (error) {
        reject(`Error listing Firebase projects: ${stderr}`);
      } else {
        const projects = JSON.parse(stdout).results;
        resolve(projects);
      }
    });
  });
};

const selectFirebaseProject = async () => {
  const projects = await listFirebaseProjects();
  const choices = projects.map((project) => ({
    name: project.displayName,
    value: project.projectId,
  }));

  const { selectedProjectId } = await inquirer.prompt([
    {
      name: "selectedProjectId",
      type: "list",
      message: "Select a Firebase project:",
      choices,
    },
  ]);

  return selectedProjectId;
};

const fetchFirebaseConfig = async (projectId) => {
  return new Promise((resolve, reject) => {
    exec(
      `firebase apps:sdkconfig web --project ${projectId}`,
      (error, stdout, stderr) => {
        if (error) {
          reject(`Error fetching Firebase config: ${stderr}`);
        } else {
          const configMatch = stdout.match(/({[\s\S]*})/);
          if (configMatch && configMatch[1]) {
            const firebaseConfig = JSON.parse(configMatch[1]);
            resolve(firebaseConfig);
          } else {
            reject("Error parsing Firebase config");
          }
        }
      }
    );
  });
};

// Update the .env files with the provided user inputs and fetched Firebase config.
const updateEnvFiles = (projectPath, answers, firebaseConfig) => {
  const envContent = {
    MONGO_URI: answers.mongoUri,
    NEXT_PUBLIC_FIREBASE_API_KEY: firebaseConfig.apiKey,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: firebaseConfig.authDomain,
    NEXT_PUBLIC_FIREBASE_DATABASE_URL: firebaseConfig.databaseURL,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: firebaseConfig.projectId,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: firebaseConfig.storageBucket,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: firebaseConfig.messagingSenderId,
    NEXT_PUBLIC_FIREBASE_APP_ID: firebaseConfig.appId,
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: firebaseConfig.measurementId,
    FIREBASE_AUTH_DB_URL: firebaseConfig.databaseURL,
    FIREBASE_SERVICE_ACCOUNT: "{}", // You would need to update this manually or fetch if possible
  };

  const updateEnv = (outputPath) => {
    const envFileContent = Object.entries(envContent)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");

    fs.writeFileSync(outputPath, envFileContent);
    console.log(`.env file created at ${outputPath}`);
  };

  updateEnv(path.join(projectPath, "sling-fe", ".env"));
  updateEnv(path.join(projectPath, "sling-api", ".env"));
  updateEnv(path.join(projectPath, "sling-studio", ".env"));
};

const generateReadme = (projectPath) => {
  const readmeContent = `
# Sling Project

## Overview

This project includes three main parts:
1. sling-fe: The frontend application.
2. sling-api: The backend API.
3. sling-studio: The studio application.

## Setup

### Install Dependencies

Run the following commands in each subdirectory to install dependencies:

\`\`\`sh
cd sling-fe
yarn install

cd ../sling-api
yarn install

cd ../sling-studio
yarn install
\`\`\`

### Running the Applications

Use the following commands to start each application:

#### sling-fe
\`\`\`sh
cd sling-fe
yarn dev
\`\`\`

#### sling-api
\`\`\`sh
cd sling-api
yarn dev
\`\`\`

#### sling-studio
\`\`\`sh
cd sling-studio
yarn dev
\`\`\`

### Environment Variables

Ensure you have a \`.env\` file in each subdirectory with the necessary environment variables.

## Deployment

Refer to the deployment guides in each subdirectory for detailed instructions.
  `;
  const readmePath = path.join(projectPath, "README.md");
  fs.writeFileSync(readmePath, readmeContent);
  console.log("README file generated.");
};

createProject();
