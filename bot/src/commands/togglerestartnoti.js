const { SlashCommandBuilder } = require('discord.js');
const db = require('../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('togglerestartnoti')
    .setDescription('Persistently toggle restart notifications on/off (trusted only)'),

  async execute(interaction) {
    const trusted = await db.isTrusted(interaction.guildId, interaction.user.id);
    if (!trusted && !interaction.member.permissions.has('Administrator')) {
      return interaction.reply({ content: '❌ You need Administrator permission or Trusted status.', flags: 64 });
    }

    const doc = await db.getCollection('botstatus').findOne({ key: 'restartNotiToggle' });
    const currentDisabled = doc?.disabled === true;

    await db.getCollection('botstatus').updateOne(
      { key: 'restartNotiToggle' },
      { $set: { disabled: !currentDisabled } },
      { upsert: true }
    );

    const status = currentDisabled ? 'enabled' : 'disabled';
    await interaction.reply({
      content: `✅ Restart notifications are now **${status}**.${status === 'disabled' ? ' You will no longer be notified when the bot restarts.' : ''}`,
      flags: 64
    });
  },
};
