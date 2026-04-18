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
      
      // Delete ALL existing commands (global)
      try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: [] });
        console.log('🗑️ Cleared old commands');
      } catch (e) {
        console.log('No existing commands to clear');
      }
      
      // Wait a moment for Discord to process the deletion
      await new Promise(r => setTimeout(r, 1000));
      
      // Register new commands
      await rest.put(
        Routes.applicationCommands(client.user.id),
        { body: commands }
      );
      console.log(`✅ Registered ${commands.length} slash commands!`);
    } catch (err) {
      console.error('❌ Failed to register commands:', err.message);
      // Try guild-specific registration as fallback
      try {
        console.log('🔄 Trying guild-specific registration...');
        const guilds = await client.guilds.fetch();
        for (const [guildId, guild] of guilds) {
          await rest.put(
            Routes.applicationGuildCommands(client.user.id, guildId),
            { body: commands }
          );
          console.log(`✅ Registered commands in guild ${guildId}`);
        }
      } catch (e2) {
        console.error('❌ Guild registration also failed:', e2.message);
      }
    }
  },
};