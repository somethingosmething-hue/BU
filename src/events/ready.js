const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`✅ Logged in as ${client.user.tag}`);

    const commands = [];
    const commandsPath = path.join(__dirname, '../commands');
    for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
      const cmd = require(path.join(commandsPath, file));
      if (cmd.data) commands.push(cmd.data.toJSON());
    }

    const rest = new REST().setToken(process.env.BOT_TOKEN);
    try {
      console.log('🔄 Registering slash commands...');
      await rest.put(
        Routes.applicationCommands(client.user.id),
        { body: commands }
      );
      console.log(`✅ Registered ${commands.length} slash commands!`);
    } catch (err) {
      console.error('❌ Failed to register commands:', err);
    }
  },
};
