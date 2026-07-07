const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database/db');

module.exports = {
  permissions: ['ManageGuild'],
  data: new SlashCommandBuilder()
    .setName('testbr')
    .setDescription('Send a test bump reminder acknowledgment embed (no cooldown)'),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const settings = await db.getServerSettings(guildId);
    const brChannelId = settings.bumpReminderChannel;

    if (!brChannelId) {
      return interaction.reply({ content: '❌ No bump reminder channel set. Use `/setbrchannel` first.', ephemeral: true });
    }

    const channel = interaction.guild.channels.cache.get(brChannelId);
    if (!channel) {
      return interaction.reply({ content: '❌ The bump reminder channel no longer exists.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor('#BE74E3')
      .setDescription(`Thank you for bumping on __Test Service__! We'll send a reminder again in **(2 hours)**.\n\n**Next →** __Disboard__ */bump*`);

    await channel.send({ embeds: [embed] });

    await interaction.reply({ content: `✅ Test embed sent to ${channel}`, ephemeral: true });
  },
};
