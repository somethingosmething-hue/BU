const { SlashCommandBuilder } = require('discord.js');
const db = require('../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sendcurlist')
    .setDescription('Send first N elements from a curlist and remove them')
    .addStringOption(opt =>
      opt.setName('name')
        .setDescription('Name of the curlist')
        .setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName('number')
        .setDescription('Number of elements to send and remove')
        .setRequired(true)
    ),
  async execute(interaction) {
    const guildId = interaction.guild?.id;
    const member = interaction.member;
    const user = interaction.user;

    // If no guild, this is a DM/client app - use global curlist
    if (!guildId) {
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

      const toSend = curlist.elements.slice(0, number);
      const remaining = curlist.elements.slice(number);

      await interaction.reply({ content: `[GLOBAL LIST: ${name}]\n${toSend.join('\n')}`, ephemeral: true });
      await db.saveGlobalCurList(name, remaining);
      return;
    }

    // Server command
    const trusted = await db.isTrusted(guildId, member.id);
    if (!trusted && !member.permissions.has('Administrator')) {
      return interaction.reply({ content: 'You need Administrator permission or Trusted role.', ephemeral: true });
    }

    const name = interaction.options.getString('name');
    const number = interaction.options.getInteger('number');

    if (number < 1) {
      return interaction.reply({ content: 'Number must be at least 1.', ephemeral: true });
    }

    const curlist = await db.getCurList(guildId, name);

    if (!curlist || curlist.elements.length === 0) {
      return interaction.reply({ content: `No elements found in list "${name}".`, ephemeral: true });
    }

    const toSend = curlist.elements.slice(0, number);
    const remaining = curlist.elements.slice(number);

    await interaction.reply({ content: `[LIST: ${name}]\n${toSend.join('\n')}` });
    await db.saveCurList(guildId, name, remaining);
  },
};
