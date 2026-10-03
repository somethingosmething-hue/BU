const { SlashCommandBuilder } = require('discord.js');
const noteSticky = require('../events/noteSticky');

module.exports = {
  permissions: ['ManageGuild'],
  data: new SlashCommandBuilder()
    .setName('note')
    .setDescription('Glue a single-line message to the bottom of this channel')
    .addStringOption(o =>
      o.setName('content')
        .setDescription('Message to glue (max 2000 chars)')
        .setRequired(true)
        .setMaxLength(2000)
    )
    .addBooleanOption(o =>
      o.setName('suppress_embeds')
        .setDescription('Prevent link embeds')
        .setRequired(false)
    ),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const channel = interaction.channel;
    const channelId = interaction.channelId;
    const content = interaction.options.getString('content');
    const suppress = interaction.options.getBoolean('suppress_embeds') || false;

    try {
      await noteSticky.setNote(guildId, channel, {
        type: 'text',
        content,
        suppress,
        gluedBy: interaction.user.id,
      });
      await interaction.reply({ content: '✅ Note set.', flags: 64 });
    } catch (e) {
      console.error('[note] set failed:', e.message);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: '❌ Failed to set note.', flags: 64 }).catch(() => {});
      } else {
        await interaction.reply({ content: '❌ Failed to set note.', flags: 64 }).catch(() => {});
      }
    }
  },
};
