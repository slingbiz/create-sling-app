#!/usr/bin/env node

const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

if (process.argv.length < 3) {
  console.log("You have to provide a name to your app.");
  console.log("For example :");
  console.log("npx create-sling-app my-app");
  console.log("yarn create sling-app my-app");
  console.log("To install dependencies using npm, Please use --use-npm flag");
  process.exit(1);
}

let projectName = process.argv[2];
let isNpm = process.argv[3];
let packageManager = "yarn";
if (isNpm === "--use-npm") {
  packageManager = "npm";
}

console.log(`Using ${packageManager} as package manager.\n`);
//Current dir path.
const currentPath = process.cwd();
//Get the correct project setup path.
const projectPath = `${currentPath}/${projectName}`;
//Git Repo name
const gitRepo = "https://github.com/slingbiz/sling-fe.git";

try {
  fs.mkdirSync(projectPath);
} catch (err) {
  if (err.code === "EEXIST") {
    console.log(
      `The file ${projectName} already exist in the current directory, please give it another name.`
    );
  } else {
    console.log(err);
  }
  process.exit(1);
}

async function main() {
  try {
    console.log("Downloading files...\n");
    execSync(`git clone --depth 1 ${gitRepo} ${projectPath}`);

    console.log("Installing Sling Frontend...\n");
    process.chdir(projectPath);

    console.log("Initializing project...\n");
    // execSync(`${packageManager} init --yes`);

    console.log("Adding Sling FE...\n");
    // execSync(`${packageManager} init --yes`);

    console.log("Installing dependencies...\n");
    execSync(`${packageManager} install`);

    console.log("Removing useless files\n");
    execSync("npx rimraf ./.git");

    try {
      fs.rmdirSync(path.join(projectPath, "bin"), { recursive: true });
    } catch (e) {
    //   console.log("Error in removing bin folder", e);
    }
    console.log("The installation is completed, Go Sling your app.\n");

    console.log(`${packageManager} run dev\n`);
    // execSync(`${packageManager} run dev`);

    console.log("You can now view your app in your browser\n");
    console.log(`Please run the following command to start the app\n`);
    console.log(`cd ${projectPath} && ${packageManager} run dev\n`);
    console.log("Local \t\t http://localhost:4087 \n");

    console.log("Note that the development build is not optimized\n");
    console.log(
      `To create a production build, use ${packageManager} build\n\n\n`
    );
    console.log(
      `Sling Fe is an extension of NextJs.\n To use its advanced features please check the official NextJs documentation. \n`
    );
  } catch (error) {
    console.log(error);
  }
}

main();
