const { SlashCommandBuilder } = require('discord.js');
const db = require('../database/db');
const { botEmbed } = require('../utils/parser');

module.exports = {
    permissions: ['ManageGuild'],
  data: new SlashCommandBuilder()
    .setName('prefix')
    .setDescription('Set the command prefix for this server')

    .addStringOption(o => o.setName('prefix').setDescription('New prefix (leave empty to see current)')),

  async execute(interaction, client) {
    const guildId = interaction.guildId;
    const prefix = interaction.options.getString('prefix');

    if (!prefix) {
      const current = db.getPrefix(guildId);
      return interaction.reply({ content: `Current prefix: \`${current || '/'}\``, ephemeral: true });
    }

    db.setPrefix(guildId, prefix);
    return interaction.reply({ embeds: [botEmbed('#77dd77').setDescription(`✅ Prefix set to \`${prefix}\``)] });
  },
};
