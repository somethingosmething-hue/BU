const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unallnotes')
    .setDescription('Remove all glued messages in this server'),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const notes = await db.getAllNotes(guildId);
    if (!notes.length) {
      return interaction.reply({ content: '📭 No notes found in this server.', ephemeral: true });
    }

    const names = notes.map(n => {
      const chan = interaction.guild.channels.cache.get(n.channelId);
      return chan ? chan.toString() : '#deleted-channel';
    });

    const embed = new EmbedBuilder()
      .setColor('#BE74E3')
      .setTitle('⚠️ Clear all notes?')
      .setDescription(`This will remove notes from:\n${names.join('\n')}\n\n**This cannot be undone.**`);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('unallconfirm').setLabel('✅ Confirm').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('unallcancel').setLabel('❌ Cancel').setStyle(ButtonStyle.Secondary)
    );

    const reply = await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });

    const filter = i => i.user.id === interaction.user.id;
    const collected = await reply.awaitMessageComponent({ filter, time: 30000 }).catch(() => null);
    if (!collected || collected.customId === 'unallcancel') {
      return collected?.update({ content: '❌ Cancelled.', embeds: [], components: [] }).catch(() => {});
    }

    for (const n of notes) {
      try {
        const chan = interaction.guild.channels.cache.get(n.channelId);
        if (chan && n.messageId) {
          const msg = await chan.messages.fetch(n.messageId).catch(() => null);
          if (msg) await msg.delete().catch(() => {});
        }
      } catch {}
      await db.deleteNote(guildId, n.channelId);
    }

    await collected.update({ content: `✅ Removed ${notes.length} note(s).`, embeds: [], components: [] });
  },
};