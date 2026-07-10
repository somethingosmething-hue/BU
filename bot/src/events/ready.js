const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
 
module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`✅ Logged in as ${client.user.tag}`);
    // Command registration is handled in bot/src/index.js on the ready event.
    // Keeping this file minimal to avoid duplicate registration.
  },
};
