const { SlashCommandBuilder } = require('discord.js');
const db = require('../database/db');

module.exports = {
  permissions: ['ManageGuild'],
  data: new SlashCommandBuilder()
    .setName('setcurlist')
    .setDescription('Set a channel to listen for curlist additions')
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('Channel to monitor for [ADD:name] messages')
        .setRequired(true)
    ),
  async execute(interaction) {
    const guildId = interaction.guild?.id;
    const member = interaction.member;

    if (!guildId) {
      return interaction.reply({ content: 'This command can only be used in a server.', flags: 64 });
    }

    const trusted = await db.isTrusted(guildId, member.id);
    if (!trusted && !member.permissions.has('Administrator')) {
      return interaction.reply({ content: 'You need Administrator permission or Trusted role.', flags: 64 });
    }

    const channel = interaction.options.getChannel('channel');
    await db.setServerSetting(guildId, 'curlistChannel', channel.id);
    await interaction.reply({ content: `CurList channel set to ${channel}. Messages starting with [ADD:name] will be processed.`, flags: 64 });
  },
};
