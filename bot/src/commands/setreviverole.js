const { SlashCommandBuilder } = require('discord.js');
const db = require('../database/db');

module.exports = {
  permissions: ['ManageGuild'],
  data: new SlashCommandBuilder()
    .setName('setreviverole')
    .setDescription('Set the role for c!revive / c!randomq commands')
    .addStringOption(o =>
      o.setName('type')
        .setDescription('Type of revive command')
        .setRequired(true)
        .addChoices(
          { name: 'Chat', value: 'chat' },
          { name: 'Random Question', value: 'randomquestion' }
        )
    )
    .addRoleOption(o =>
      o.setName('role')
        .setDescription('Role to ping and assign')
        .setRequired(true)
    ),
  async execute(interaction) {
    const type = interaction.options.getString('type');
    const role = interaction.options.getRole('role');
    const key = `reviveRole_${type}`;
    await db.setServerSetting(interaction.guildId, key, role.id);
    await interaction.reply({
      content: `<:writing:1526779827611500604> Revive role for **${type}** set to ${role}.`,
      flags: 64,
    });
  },
};
