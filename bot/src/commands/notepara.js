const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('notepara')
    .setDescription('Glue a multi-line message to the bottom of this channel'),

  async execute(interaction) {
    const modal = new ModalBuilder()
      .setCustomId('notepara:submit')
      .setTitle('Glue a multi-line note');

    const content = new TextInputBuilder()
      .setCustomId('content')
      .setLabel('Message content')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(2000);

    const suppress = new TextInputBuilder()
      .setCustomId('suppress')
      .setLabel('Suppress link embeds? (yes/no)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(3);

    modal.addComponents(
      new ActionRowBuilder().addComponents(content),
      new ActionRowBuilder().addComponents(suppress)
    );

    await interaction.showModal(modal);
  },
};