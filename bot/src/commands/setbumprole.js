const { SlashCommandBuilder, Role } = require('discord.js');
const db = require('../database/db');
const { botEmbed } = require('../utils/parser');

module.exports = {
  permissions: ['ManageGuild'],
  data: new SlashCommandBuilder()
    .setName('setbumprole')
    .setDescription('Set the role to ping in bump reminders')
    .addRoleOption(o =>
      o.setName('role')
        .setDescription('Role to ping in bump reminders')
        .setRequired(true)
    ),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const role = interaction.options.getRole('role');

    await db.setServerSetting(guildId, 'bumpRole', role.id);

    const embed = botEmbed('#BE74E3')
      .setDescription(`✅ Bump reminders will now ping ${role}`);

    await interaction.reply({ embeds: [embed] });
  },
};
