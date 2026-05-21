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
 
    console.log(`📦 Loaded ${commands.length} commands, registering...`);
 
    const rest = new REST().setToken(process.env.BOT_TOKEN);
 
    try {
      const guilds = await client.guilds.fetch();
 
      for (const [guildId] of guilds) {
        await rest.put(
          Routes.applicationGuildCommands(client.user.id, guildId),
          { body: commands }
        );
        console.log(`✅ Registered ${commands.length} commands in guild ${guildId}`);
      }
    } catch (err) {
      console.error('❌ Failed to register commands:', err.message);
    }
  },
};
