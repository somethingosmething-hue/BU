const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
  permissions: ['ManageGuild'],
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

    const extra = new TextInputBuilder()
      .setCustomId('extra')
      .setLabel('Extra: {button:name} {server_name} ...')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setMaxLength(1000);

    modal.addComponents(
      new ActionRowBuilder().addComponents(content),
      new ActionRowBuilder().addComponents(suppress),
      new ActionRowBuilder().addComponents(extra)
    );

    await interaction.showModal(modal);
  },
};