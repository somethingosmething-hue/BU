const { SlashCommandBuilder, ChannelType } = require('discord.js');
const db = require('../database/db');
const { botEmbed } = require('../utils/parser');

module.exports = {
  permissions: ['ManageGuild'],
  data: new SlashCommandBuilder()
    .setName('setboostchannel')
    .setDescription('Set the channel where boost messages are sent')
    .addChannelOption(o =>
      o.setName('channel')
        .setDescription('Text channel for boost announcements')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    ),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const channel = interaction.options.getChannel('channel');

    await db.setServerSetting(guildId, 'boostChannel', channel.id);

    const embed = botEmbed('#ff73fa')
      .setDescription(`✅ Boost announcements will be sent to ${channel}`);

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
