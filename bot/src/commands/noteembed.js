const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('noteembed')
    .setDescription('Glue a rich embed to the bottom of this channel'),

  async execute(interaction) {
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