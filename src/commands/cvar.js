const { SlashCommandBuilder } = require('discord.js');
const db = require('../database/db');
const { botEmbed } = require('../utils/parser');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cvar')
    .setDescription('Custom variable management')
    .setDefaultMemberPermissions(0x20)
    .addSubcommand(s => s.setName('set').setDescription('Set a variable')
      .addStringOption(o => o.setName('type').setDescription('global or user').setRequired(true).addChoices({ name: 'global', value: 'global' }, { name: 'user', value: 'user' }))
      .addStringOption(o => o.setName('name').setDescription('Variable name').setRequired(true))
      .addStringOption(o => o.setName('value').setDescription('Value (optional for user type)').setRequired(false))
      .addUserOption(o => o.setName('user').setDescription('User (user type only)')))
    .addSubcommand(s => s.setName('get').setDescription('Get a variable')
      .addStringOption(o => o.setName('type').setDescription('global or user').setRequired(true).addChoices({ name: 'global', value: 'global' }, { name: 'user', value: 'user' }))
      .addStringOption(o => o.setName('name').setDescription('Variable name').setRequired(true))
      .addUserOption(o => o.setName('user').setDescription('User (user type only)')))
    .addSubcommand(s => s.setName('add').setDescription('Add to a numeric variable')
      .addStringOption(o => o.setName('type').setDescription('global or user').setRequired(true).addChoices({ name: 'global', value: 'global' }, { name: 'user', value: 'user' }))
      .addStringOption(o => o.setName('name').setDescription('Variable name').setRequired(true))
      .addIntegerOption(o => o.setName('amount').setDescription('Amount to add').setRequired(true))
      .addUserOption(o => o.setName('user').setDescription('User (user type only)')))
    .addSubcommand(s => s.setName('delete').setDescription('Delete a variable')
      .addStringOption(o => o.setName('type').setDescription('global or user').setRequired(true).addChoices({ name: 'global', value: 'global' }, { name: 'user', value: 'user' }))
      .addStringOption(o => o.setName('name').setDescription('Variable name').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('List variables')
      .addStringOption(o => o.setName('type').setDescription('global or user').setRequired(true).addChoices({ name: 'global', value: 'global' }, { name: 'user', value: 'user' }))
      .addUserOption(o => o.setName('user').setDescription('User (user type only)'))),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const type = interaction.options.getString('type');
    const varName = interaction.options.getString('name');
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const guildId = interaction.guildId;

    if (type === 'global') {
      if (sub === 'set') {
        const value = interaction.options.getString('value') || '0';
        db.setGlobalVar(varName, value);
        return interaction.reply({ embeds: [botEmbed('#77dd77').setDescription(`✅ Set global **${varName}** = \`${value}\``)] });
      }
      if (sub === 'get') {
        const value = db.getGlobalVar(varName);
        if (value === null) return interaction.reply({ content: `❌ No global variable **${varName}**`, ephemeral: true });
        return interaction.reply({ embeds: [botEmbed().setTitle(`📊 global::${varName}`).setDescription(`**${value}**`)] });
      }
      if (sub === 'add') {
        const amount = interaction.options.getInteger('amount');
        const current = parseInt(db.getGlobalVar(varName)) || 0;
        db.setGlobalVar(varName, String(current + amount));
        return interaction.reply({ embeds: [botEmbed('#77dd77').setDescription(`✅ Added **${amount}** to global **${varName}**. New: **${current + amount}**`)] });
      }
      if (sub === 'delete') {
        db.deleteGlobalVar(varName);
        return interaction.reply({ embeds: [botEmbed().setDescription(`✅ Deleted global **${varName}**`)] });
      }
      if (sub === 'list') {
        const vars = db.getGlobalVars();
        const entries = Object.entries(vars);
        if (!entries.length) return interaction.reply({ content: '📭 No global variables.', ephemeral: true });
        const lines = entries.map(([k, v]) => `• **${k}**: \`${v}\``);
        return interaction.reply({ embeds: [botEmbed().setTitle('📋 Global Variables').setDescription(lines.join('\n'))] });
      }
    }

    if (type === 'user') {
      if (sub === 'set') {
        const value = interaction.options.getString('value') || '0';
        db.setUserVar(guildId, targetUser.id, varName, value);
        return interaction.reply({ embeds: [botEmbed('#77dd77').setDescription(`✅ Set **${varName}** = \`${value}\` for ${targetUser}`)] });
      }
      if (sub === 'get') {
        const value = db.getUserVar(guildId, targetUser.id, varName);
        if (value === null) return interaction.reply({ content: `❌ No variable **${varName}** for ${targetUser}`, ephemeral: true });
        return interaction.reply({ embeds: [botEmbed().setTitle(`📊 user::${varName}`).setDescription(`**${value}**`)] });
      }
      if (sub === 'add') {
        const amount = interaction.options.getInteger('amount');
        const current = parseInt(db.getUserVar(guildId, targetUser.id, varName)) || 0;
        db.setUserVar(guildId, targetUser.id, varName, String(current + amount));
        return interaction.reply({ embeds: [botEmbed('#77dd77').setDescription(`✅ Added **${amount}** to **${varName}** for ${targetUser}. New: **${current + amount}**`)] });
      }
      if (sub === 'delete') {
        db.deleteUserVar(guildId, targetUser.id, varName);
        return interaction.reply({ embeds: [botEmbed().setDescription(`✅ Deleted **${varName}** for ${targetUser}`)] });
      }
      if (sub === 'list') {
        const vars = db.getAllUserVars(guildId, targetUser.id);
        const entries = Object.entries(vars);
        if (!entries.length) return interaction.reply({ content: `📭 No variables for ${targetUser}`, ephemeral: true });
        const lines = entries.map(([k, v]) => `• **${k}**: \`${v}\``);
        return interaction.reply({ embeds: [botEmbed().setTitle(`📋 user variables for ${targetUser.username}`).setDescription(lines.join('\n'))] });
      }
    }
  },
};