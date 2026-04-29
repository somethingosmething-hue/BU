const { SlashCommandBuilder } = require('discord.js');
const db = require('../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('eshowcurlist')
    .setDescription('Show and remove first N elements from a global curlist (ephemeral, DM only)')
    .addStringOption(opt =>
      opt.setName('name')
        .setDescription('Name of the global curlist')
        .setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName('number')
        .setDescription('Number of elements to show and remove')
        .setRequired(true)
    ),
  async execute(interaction) {
    const guildId = interaction.guild?.id;
    const user = interaction.user;

    // This command should only be used in DMs
    if (guildId) {
      return interaction.reply({ content: 'This command can only be used in DMs.', ephemeral: true });
    }

    // Check if user is globally trusted
    if (!db.isGloballyTrusted(user.id)) {
      return interaction.reply({ content: '❌ You are not globally trusted to use this command.', ephemeral: true });
    }

    const name = interaction.options.getString('name');
    const number = interaction.options.getInteger('number');

    if (number < 1) {
      return interaction.reply({ content: 'Number must be at least 1.', ephemeral: true });
    }

    const curlist = await db.getGlobalCurList(name);

    if (!curlist || curlist.elements.length === 0) {
      return interaction.reply({ content: `No elements found in global list "${name}".`, ephemeral: true });
    }

    const toShow = curlist.elements.slice(0, number);
    const remaining = curlist.elements.slice(number);

    await interaction.reply({ content: `[GLOBAL LIST: ${name}]\n${toShow.join('\n')}`, ephemeral: true });
    await db.saveGlobalCurList(name, remaining);
  },
};
