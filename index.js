const fs = require('fs');
const { execSync } = require('child_process');

const repoUrl = 'https://github.com/somethingosmething-hue/BU.git';

if (!fs.existsSync('./src')) {
  console.log('Cloning repo...');
  execSync('git clone --depth 1 ' + repoUrl + ' _tmp_clone', { stdio: 'inherit' });
  execSync('cp -r _tmp_clone/. .', { stdio: 'inherit' });
  execSync('rm -rf _tmp_clone', { stdio: 'inherit' });
  console.log('Installing dependencies...');
  execSync('npm install', { stdio: 'inherit' });
} else if (fs.existsSync('./.git')) {
  console.log('Pulling latest changes...');
  try {
    execSync('git fetch origin main', { stdio: 'inherit' });
    execSync('git reset --hard origin/main', { stdio: 'inherit' });
    console.log('Updated successfully.');
  } catch (e) {
    console.log('Git update failed, continuing with existing files.');
  }
}

require('dotenv').config();
const client = require('./src/index');
