const { SlashCommandBuilder } = require('discord.js');
const db = require('../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resetcurlist')
    .setDescription('Reset/empty a curlist')
    .addStringOption(opt =>
      opt.setName('name')
        .setDescription('Name of the curlist to reset')
        .setRequired(true)
    ),
  async execute(interaction) {
    const guildId = interaction.guild.id;
    const member = interaction.member;

    const trusted = await db.isTrusted(guildId, member.id);
    if (!trusted && !member.permissions.has('Administrator')) {
      return interaction.reply({ content: 'You need Administrator permission or Trusted role.', ephemeral: true });
    }

    const name = interaction.options.getString('name');
    const curlist = await db.getCurList(guildId, name);

    if (!curlist) {
      return interaction.reply({ content: `List "${name}" does not exist.`, ephemeral: true });
    }

    await db.saveCurList(guildId, name, []);
    await interaction.reply({ content: `✅ List "${name}" has been reset (now empty).`, ephemeral: true });
  },
};
