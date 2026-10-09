const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database/db');

module.exports = {
  permissions: ['ManageGuild'],
  data: new SlashCommandBuilder()
    .setName('editnote')
    .setDescription('Edit the glued message in this channel')
    .addStringOption(o =>
      o.setName('extra')
        .setDescription('New extra variables (blank to clear, omit to keep)')
        .setRequired(false)
        .setMaxLength(1000)
    ),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const channelId = interaction.channelId;
    const note = await db.getNote(guildId, channelId);
    if (!note) {
      return interaction.reply({ content: '❌ No note set in this channel.', flags: 64 });
    }

    // For embed notes the modal is already at Discord's 5-input cap, so a
    // provided `extra` is staged and consumed on submit. Text notes get a
    // visible input prefilled below.
    const extraOpt = interaction.options.getString('extra');
    const extraProvided = extraOpt !== null;
    if (extraProvided && note.type === 'embed') {
      const noteSticky = require('../events/noteSticky');
      // Stage verbatim: '' means "clear", null is never staged (omitted).
      noteSticky.stagePendingExtra(guildId, channelId, interaction.user.id, extraOpt || '');
    }

    if (note.type === 'embed') {
      const modal = new ModalBuilder()
        .setCustomId('editnoteembed:submit')
        .setTitle('Edit embed note');

      const title = new TextInputBuilder()
        .setCustomId('title')
        .setLabel('Title')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(256)
        .setValue(note.title || '');

      const description = new TextInputBuilder()
        .setCustomId('description')
        .setLabel('Description')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(4000)
        .setValue(note.description || '');

      const color = new TextInputBuilder()
        .setCustomId('color')
        .setLabel('Color (#hex)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(7)
        .setValue(note.color || '#66C2FF');

      const thumbnail = new TextInputBuilder()
        .setCustomId('thumbnail')
        .setLabel('Thumbnail image URL (leave blank to keep)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(2000);

      const image = new TextInputBuilder()
        .setCustomId('image')
        .setLabel('Large image URL (leave blank to keep)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(2000);

      modal.addComponents(
        new ActionRowBuilder().addComponents(title),
        new ActionRowBuilder().addComponents(description),
        new ActionRowBuilder().addComponents(color),
        new ActionRowBuilder().addComponents(thumbnail),
        new ActionRowBuilder().addComponents(image)
      );

      await interaction.showModal(modal);
    } else {
      const modal = new ModalBuilder()
        .setCustomId('editnotetext:submit')
        .setTitle('Edit text note');

      const content = new TextInputBuilder()
        .setCustomId('content')
        .setLabel('Message content')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(2000)
        .setValue(note.content || '');

      const extra = new TextInputBuilder()
        .setCustomId('extra')
        .setLabel('Extra: {button:name} ... (blank to clear)')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(1000)
        .setValue(extraProvided ? (extraOpt || '') : (note.extra || ''));

      modal.addComponents(
        new ActionRowBuilder().addComponents(content),
        new ActionRowBuilder().addComponents(extra)
      );
      await interaction.showModal(modal);
    }
  },
};