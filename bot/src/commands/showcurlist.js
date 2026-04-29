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
    const user = interaction.user;

    const name = interaction.options.getString('name');

    // If no guild, this is a DM/client app - show global curlist
    if (!guildId) {
      if (!db.isGloballyTrusted(user.id)) {
        return interaction.reply({ content: '❌ You are not globally trusted to use this command.', ephemeral: true });
      }

      const curlist = await db.getGlobalCurList(name);

      if (!curlist || curlist.elements.length === 0) {
        return interaction.reply({ content: `No elements found in global list "${name}".`, ephemeral: true });
      }

      const content = `[GLOBAL FULL LIST: ${name}]\n${curlist.elements.join('\n')}`;
      await interaction.reply({ content, ephemeral: true });
      return;
    }

    // Server command
    const trusted = await db.isTrusted(guildId, member.id);
    if (!trusted && !member.permissions.has('Administrator')) {
      return interaction.reply({ content: 'You need Administrator permission or Trusted role.', ephemeral: true });
    }

    const curlist = await db.getCurList(guildId, name);

    if (!curlist || curlist.elements.length === 0) {
      return interaction.reply({ content: `No elements found in list "${name}".`, ephemeral: true });
    }

    const content = `[FULL LIST: ${name}]\n${curlist.elements.join('\n')}`;
    await interaction.reply({ content, ephemeral: true });
  },
};
