const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database/db');
const { botEmbed } = require('../utils/parser');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cvar')
    .setDescription('Custom user variable management')
    .setDefaultMemberPermissions(0x20)
    .addSubcommand(s => s.setName('set').setDescription('Set a user variable')
      .addStringOption(o => o.setName('name').setDescription('Variable name').setRequired(true))
      .addStringOption(o => o.setName('value').setDescription('Value to set').setRequired(true))
      .addUserOption(o => o.setName('user').setDescription('Target user (defaults to you)')))
    .addSubcommand(s => s.setName('get').setDescription('Get a user variable')
      .addStringOption(o => o.setName('name').setDescription('Variable name').setRequired(true))
      .addUserOption(o => o.setName('user').setDescription('Target user')))
    .addSubcommand(s => s.setName('add').setDescription('Add to a numeric variable')
      .addStringOption(o => o.setName('name').setDescription('Variable name').setRequired(true))
      .addIntegerOption(o => o.setName('amount').setDescription('Amount to add').setRequired(true))
      .addUserOption(o => o.setName('user').setDescription('Target user')))
    .addSubcommand(s => s.setName('remove').setDescription('Remove a user variable')
      .addStringOption(o => o.setName('name').setDescription('Variable name').setRequired(true))
      .addUserOption(o => o.setName('user').setDescription('Target user')))
    .addSubcommand(s => s.setName('list').setDescription('List all variables for a user')
      .addUserOption(o => o.setName('user').setDescription('Target user')))
    .addSubcommand(s => s.setName('clear').setDescription('Clear all variables for a user')
      .addUserOption(o => o.setName('user').setDescription('Target user'))),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const varName = interaction.options.getString('name');

    if (sub === 'set') {
      const value = interaction.options.getString('value');
      db.setUserVar(guildId, targetUser.id, varName, value);
      return interaction.reply({
        embeds: [botEmbed('#77dd77').setDescription(`✅ Set **${varName}** = \`${value}\` for ${targetUser}`)],
      });
    }

    if (sub === 'get') {
      const value = db.getUserVar(guildId, targetUser.id, varName);
      if (value === null) return interaction.reply({ content: `❌ No variable named **${varName}** for ${targetUser}.`, ephemeral: true });
      return interaction.reply({
        embeds: [botEmbed().setTitle(`📊 ${varName}`).setDescription(`**${value}**`)],
      });
    }

    if (sub === 'add') {
      const amount = interaction.options.getInteger('amount');
      const current = db.getUserVar(guildId, targetUser.id, varName);
      const currentNum = parseInt(current) || 0;
      db.setUserVar(guildId, targetUser.id, varName, currentNum + amount);
      return interaction.reply({
        embeds: [botEmbed('#77dd77').setDescription(`✅ Added **${amount}** to **${varName}** for ${targetUser}. New value: **${currentNum + amount}**`)],
      });
    }

    if (sub === 'remove') {
      db.deleteUserVar(guildId, targetUser.id, varName);
      return interaction.reply({
        embeds: [botEmbed().setDescription(`✅ Removed variable **${varName}** from ${targetUser}.`)],
      });
    }

    if (sub === 'list') {
      const vars = db.getAllUserVars(guildId, targetUser.id);
      const entries = Object.entries(vars);
      if (!entries.length) return interaction.reply({ content: `📭 No variables set for ${targetUser}.`, ephemeral: true });

      const lines = entries.map(([k, v]) => `• **${k}**: \`${v}\``);
      return interaction.reply({
        embeds: [botEmbed().setTitle(`📋 Variables for ${targetUser.username}`).setDescription(lines.join('\n'))],
      });
    }

    if (sub === 'clear') {
      const vars = db.getAllUserVars(guildId, targetUser.id);
      for (const key of Object.keys(vars)) {
        db.deleteUserVar(guildId, targetUser.id, key);
      }
      return interaction.reply({
        embeds: [botEmbed().setDescription(`✅ Cleared all variables for ${targetUser}.`)],
      });
    }
  },
};