const fs = require('fs');
const { execSync } = require('child_process');
const repoUrl = 'https://github.com/somethingosmething-hue/BU.git';

function run(cmd) {
  try {
    execSync(cmd, { stdio: 'inherit' });
  } catch (e) {
    console.error('Error:', e.message);
  }
}

if (!fs.existsSync('./bot')) {
  console.log('📦 Cloning repo...');
  run('git clone --depth 1 ' + repoUrl + ' .');
  console.log('📦 Installing dependencies...');
  run('npm install');
} else {
  console.log('📦 Updating...');
  run('git fetch origin main');
  run('git reset --hard origin/main');
}

console.log('✅ Ready!');
require('dotenv').config();
require('./bot/src/index');