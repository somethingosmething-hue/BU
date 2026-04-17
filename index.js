require('dotenv').config();
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const repoUrl = 'https://github.com/somethingosmething-hue/BU.git';
const branch = 'main';

function run(cmd, cwd = process.cwd()) {
  try {
    execSync(cmd, { cwd, stdio: 'inherit' });
  } catch (e) {}
}

if (!fs.existsSync('./src')) {
  console.log('📦 First run detected - cloning repo...');
  run(`git clone --depth 1 ${repoUrl} .`);
  run('npm install');
}

const client = require('./src/index');