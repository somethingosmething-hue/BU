const fs = require('fs');
const { execSync } = require('child_process');

function run(cmd) {
  try { execSync(cmd, { stdio: 'inherit' }); }
  catch (e) { console.error('Error:', e.message); }
}

if (!fs.existsSync('./bot') || !fs.existsSync('./package.json')) {
  console.log('📦 Cloning repo...');
  run('rm -rf _tmp_clone');
  run('git clone --depth 1 https://github.com/somethingosmething-hue/BU.git _tmp_clone');
  run('cp -r _tmp_clone/* .');
  run('cp -r _tmp_clone/.* . 2>/dev/null || true');
  run('rm -rf _tmp_clone');
  console.log('📦 Installing dependencies...');
  run('npm install');
} else {
  console.log('📦 Updating from GitHub...');
  run('git fetch origin main');
  run('git reset --hard origin/main');
}

console.log('✅ Ready!');
require('dotenv').config();
require('./bot/src/index');