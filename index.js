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
}
 
require('dotenv').config();
const client = require('./src/index');
