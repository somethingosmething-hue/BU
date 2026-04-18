const fs = require('fs');
const { execSync } = require('child_process');

// First time setup
if (!fs.existsSync('./src')) {
  console.log('📦 Cloning repo...');
  execSync('git clone --depth 1 https://github.com/somethingosmething-hue/BU .', { stdio: 'inherit' });
  console.log('📦 Installing dependencies...');
  execSync('npm install', { stdio: 'inherit' });
}

// Ensure .env exists
if (!fs.existsSync('./.env')) {
  fs.writeFileSync('./.env', 'BOT_TOKEN=YOUR_BOT_TOKEN_HERE\n');
}

// Load dotenv and start bot
require('dotenv').config();
const client = require('./src/index');