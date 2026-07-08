const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database/db');

module.exports = {
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
    const channelId = interaction.channelId;
    const content = interaction.options.getString('content');
    const suppress = interaction.options.getBoolean('suppress_embeds') || false;

    const existing = await db.getNote(guildId, channelId);
    if (existing?.messageId) {
      try {
        const old = await interaction.channel.messages.fetch(existing.messageId).catch(() => null);
        if (old) await old.delete().catch(() => {});
      } catch {}
    }

    const flags = (suppress ? 1 << 2 : 0) | (1 << 12);
    const msg = await interaction.channel.send({ content, flags });

    await db.saveNote(guildId, channelId, {
      type: 'text',
      content,
      messageId: msg.id,
      suppress,
      gluedBy: interaction.user.id,
      gluedAt: Date.now(),
    });

    await interaction.reply({ content: '✅ Note set.', ephemeral: true });
  },
};