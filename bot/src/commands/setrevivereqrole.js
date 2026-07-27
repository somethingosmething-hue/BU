const { SlashCommandBuilder } = require('discord.js');
const db = require('../database/db');

module.exports = {
  permissions: ['ManageGuild'],
  data: new SlashCommandBuilder()
    .setName('setrevivereqrole')
    .setDescription('Set a required role to use c!revive / c!randomq')
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
        .setDescription('Role required to trigger (or higher)')
        .setRequired(true)
    ),
  async execute(interaction) {
    const type = interaction.options.getString('type');
    const role = interaction.options.getRole('role');
    const key = `reviveReqRole_${type}`;
    await db.setServerSetting(interaction.guildId, key, role.id);
    const cmdLabel = type === 'chat' ? 'revive' : 'randomq';
    await interaction.reply({
      content: '<:writing:1526779827611500604> **' + type + '** revives now require the role of ' + role.toString() + ' or higher.\n-# <:hawo:1490521492696465519> To trigger this revive type, do **c!' + cmdLabel + '**',
      flags: 64,
    });
  },
};
