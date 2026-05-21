const { SlashCommandBuilder } = require('discord.js');
const db = require('../database/db');
const { botEmbed } = require('../utils/parser');

module.exports = {
    permissions: ['ManageGuild'],
  data: new SlashCommandBuilder()
.setName('poll')
    .setDescription('Create a reaction poll')

    .addStringOption(o => o.setName('title').setDescription('Poll title').setRequired(true))
    .addStringOption(o => o.setName('options').setDescription('Options separated by semicolons (e.g. Yes;No;Maybe)').setRequired(true)),

  async execute(interaction, client) {
    const guildId = interaction.guildId;
    const title = interaction.options.getString('title');
    const options = interaction.options.getString('options').split(';').map(o => o.trim()).filter(o => o);

    if (options.length < 2) {
      return interaction.reply({ content: 'Please provide at least 2 options separated by semicolons.' });
    }

    const embed = botEmbed('#77dd77')
      .setTitle('📊 ' + title)
      .setDescription(options.map((opt, i) => `${i + 1}. ${opt}`).join('\n'));

    const message = await interaction.reply({ embeds: [embed], fetchReply: true });

    for (let i = 0; i < options.length; i++) {
      await message.react(`${i + 1}\u20e3`);
    }
  },
};
