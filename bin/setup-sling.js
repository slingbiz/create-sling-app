#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

if (process.argv.length < 3) {
  console.log('You have to provide a name to your app.');
  console.log('For example :');
  console.log('npx create-sling-app my-app');
  console.log('yarn create sling-app my-app');
  process.exit(1);
}

const packageManager = process.argv[0];
let projectName = process.argv[2];

if (packageManager === 'npm') {
  projectName = process.argv[2];

} else if (packageManager === 'yarn') {
  projectName = process.argv[3];
}

//Current dir path.
const currentPath = process.cwd();
//Get the correct project setup path.
const projectPath = `${currentPath}/${projectName}`;
//Git Repo name
const gitRepo = 'https://github.com/slingbiz/sling-fe.git';

try {
  fs.mkdirSync(projectPath);
} catch (err) {
  if (err.code === 'EEXIST') {
    console.log(`The file ${projectName} already exist in the current directory, please give it another name.`);
  } else {
    console.log(error);
  }
  process.exit(1);
}


async function main() {
  try {
    console.log('Downloading files...\n');
    execSync(`git clone --depth 1 ${gitRepo} ${projectPath}`);

    console.log('Installing Sling Frontend...\n');
    process.chdir(projectPath);

    console.log('Initializing project...\n');
    execSync(`${packageManager} init --yes`);

    console.log('Adding Sling FE...\n');
    execSync(`${packageManager} init --yes`);

    console.log('Installing dependencies...\n');
    execSync(`${packageManager} install`);

    console.log('Removing useless files\n');
    execSync('npx rimraf ./.git');
    fs.rmdirSync(path.join(projectPath, 'bin'), { recursive: true });

    console.log('The installation is completed, Go Sling your frontend!\n');

    console.log(`${packageManager} run dev\n`);
    execSync(`${packageManager} run dev`);

    console.log('You can now view your app in your browser\n');
    console.log('Local \t\t http://localhost:4087');

    console.log('Note that the development build is not optimized\n');
    console.log(`To create a production build, use ${packageManager}\n\n\n`);
    console.log(`Sling Fe is an extension of NextJs\n. To use its advanced features please check the official NextJs documentation. \n`);


  } catch (error) {
    console.log(error);
  }
}
main();



