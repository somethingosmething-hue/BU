const fs = require('fs');
const { execSync } = require('child_process');

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });

// Save .env before any file operations
const savedEnv = fs.existsSync('.env') ? fs.readFileSync('.env') : null;

if (!fs.existsSync('.git')) {
  console.log('📦 Cloning repo...');
  run('git clone --depth 1 https://github.com/somethingosmething-hue/BU.git .');
  console.log('📦 Installing dependencies...');
  run('npm install');
} else {
  console.log('📦 Updating from GitHub...');
  run('git fetch origin main && git reset --hard origin/main');
}

// Restore .env (prevent git from overwriting it)
if (savedEnv) {
  fs.writeFileSync('.env', savedEnv);
  console.log('💾 Restored .env');
}

console.log('✅ Ready!');
require('dotenv').config();
require('./src/index');
