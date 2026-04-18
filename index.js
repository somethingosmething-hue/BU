const fs = require('fs');
const { execSync } = require('child_process');

const repoUrl = 'https://github.com/somethingosmething-hue/BU.git';

if (!fs.existsSync('./src')) {
  console.log('📦 Cloning repo...');
  execSync('git clone --depth 1 ' + repoUrl + ' .', { stdio: 'inherit' });
  console.log('📦 Installing dependencies...');
  execSync('npm install', { stdio: 'inherit' });
}

if (!fs.existsSync('./.env')) {
  fs.writeFileSync('./.env', 'BOT_TOKEN=YOUR_BOT_TOKEN_HERE\n');
}

require('dotenv').config();
const client = require('./src/index');