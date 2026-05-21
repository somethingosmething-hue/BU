const { SlashCommandBuilder } = require('discord.js');
const db = require('../database/db');
const { botEmbed } = require('../utils/parser');

module.exports = {
  permissions: ['ManageGuild'],
  data: new SlashCommandBuilder()
    .setName('setboostmessage')
    .setDescription('Set the message sent when someone boosts (use {user} as placeholder)')
    .addStringOption(o =>
      o.setName('message')
        .setDescription('Boost message template — {user} becomes the booster mention')
        .setRequired(true)
        .setMaxLength(2000)
    ),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const msg = interaction.options.getString('message');

    await db.setServerSetting(guildId, 'boostMessage', msg);

    const embed = botEmbed('#ff73fa')
      .setDescription(`✅ Boost message set!\n> ${msg.replace(/\{user\}/gi, '@User')}`);

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
