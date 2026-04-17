require('dotenv').config();
const fs = require('fs');
const { execSync } = require('child_process');

const repoUrl = 'https://github.com/somethingosmething-hue/BU.git';

function run(cmd) {
  try {
    execSync(cmd, { stdio: 'inherit' });
  } catch (e) {}
}

if (!fs.existsSync('./src')) {
  console.log('📦 Cloning repo...');
  run(`git clone --depth 1 ${repoUrl} .`);
  console.log('📦 Installing dependencies...');
  run('npm install');
}

const client = require('./src/index');