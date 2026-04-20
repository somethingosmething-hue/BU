const fs = require('fs');
const { execSync } = require('child_process');

function run(cmd) {
  try { execSync(cmd, { stdio: 'inherit' }); }
  catch (e) { console.error('Error:', e.message); }
}

// Clean up leftover folders
run('rm -rf _tmp_clone');

// Save existing .env before updating
let existingEnv = '';
if (fs.existsSync('.env')) {
  existingEnv = fs.readFileSync('.env', 'utf8');
  console.log('💾 Saved existing .env');
}

if (!fs.existsSync('./bot') || !fs.existsSync('./package.json')) {
  console.log('📦 Cloning repo...');
  run('git clone --depth 1 https://github.com/somethingosmething-hue/BU.git _tmp_clone');

  // Copy normal files
  run('cp -r _tmp_clone/* .');

  // Copy hidden files/folders EXCEPT .git
  run('find _tmp_clone -maxdepth 1 -name ".*" ! -name ".git" ! -name "." -exec cp -r {} . \\;');

  run('rm -rf _tmp_clone');
  console.log('📦 Installing dependencies...');
  run('npm install');
} else {
  console.log('📦 Updating from GitHub...');
  try { run('git fetch origin main'); } catch {}
  try { run('git stash'); } catch {}
  try { run('git reset --hard origin/main'); } catch {}
}

// Restore .env
if (existingEnv) {
  fs.writeFileSync('.env', existingEnv);
  console.log('💾 Restored .env');
}

console.log('✅ Ready!');
require('dotenv').config();
require('./bot/src/index');
