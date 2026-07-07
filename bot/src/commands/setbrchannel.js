const { SlashCommandBuilder, ChannelType } = require('discord.js');
const db = require('../database/db');
const { botEmbed } = require('../utils/parser');

module.exports = {
  permissions: ['ManageGuild'],
  data: new SlashCommandBuilder()
    .setName('setbrchannel')
    .setDescription('Set the channel for bump/vote reminders')
    .addChannelOption(o =>
      o.setName('channel')
        .setDescription('Channel for bump/vote reminders')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    ),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const channel = interaction.options.getChannel('channel');

    await db.setServerSetting(guildId, 'bumpReminderChannel', channel.id);

    const embed = botEmbed('#BE74E3')
      .setDescription(`✅ Bump/vote reminders will be sent to ${channel}`);

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
