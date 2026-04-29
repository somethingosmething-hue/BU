const { SlashCommandBuilder } = require('discord.js');
const db = require('../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('showcurlist')
    .setDescription('Show all elements in a curlist (only visible to you)')
    .addStringOption(opt =>
      opt.setName('name')
        .setDescription('Name of the curlist')
        .setRequired(true)
    ),
  async execute(interaction) {
    const guildId = interaction.guild?.id;
    const member = interaction.member;

    if (!guildId) {
      return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    }

    const trusted = await db.isTrusted(guildId, member.id);
    if (!trusted && !member.permissions.has('Administrator')) {
      return interaction.reply({ content: 'You need Administrator permission or Trusted role.', ephemeral: true });
    }

    const name = interaction.options.getString('name');
    const curlist = await db.getCurList(guildId, name);

    if (!curlist || curlist.elements.length === 0) {
      return interaction.reply({ content: `No elements found in list "${name}".`, ephemeral: true });
    }

    const content = `[FULL LIST: ${name}]\n${curlist.elements.join('\n')}`;
    await interaction.reply({ content, ephemeral: true });
  },
};
