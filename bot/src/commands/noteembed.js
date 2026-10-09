const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
  permissions: ['ManageGuild'],
  data: new SlashCommandBuilder()
    .setName('noteembed')
    .setDescription('Glue a rich embed to the bottom of this channel')
    .addStringOption(o =>
      o.setName('extra')
        .setDescription('Extra variables, e.g. {button:name} {addselect:name} {server_name}')
        .setRequired(false)
        .setMaxLength(1000)
    ),

  async execute(interaction) {
    // The embed modal already uses all 5 allowed inputs, so `extra` travels
    // via short-lived staged storage and is consumed on modal submit.
    const extra = interaction.options.getString('extra') || null;
    if (extra) {
      const noteSticky = require('../events/noteSticky');
      noteSticky.stagePendingExtra(interaction.guildId, interaction.channelId, interaction.user.id, extra);
    }

    const modal = new ModalBuilder()
      .setCustomId('noteembed:submit')
      .setTitle('Glue an embed note');

    const title = new TextInputBuilder()
      .setCustomId('title')
      .setLabel('Title (optional)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(256);

    const description = new TextInputBuilder()
      .setCustomId('description')
      .setLabel('Description')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setMaxLength(4000);

    const color = new TextInputBuilder()
      .setCustomId('color')
      .setLabel('Color (#hex, default #66C2FF)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(7);

    const thumbnail = new TextInputBuilder()
      .setCustomId('thumbnail')
      .setLabel('Thumbnail image URL')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(2000);

    const image = new TextInputBuilder()
      .setCustomId('image')
      .setLabel('Large image URL')
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
  },
};