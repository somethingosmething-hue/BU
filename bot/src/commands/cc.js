const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database/db');
const { botEmbed } = require('../utils/parser');

module.exports = {
    permissions: ['ManageGuild'],
  data: new SlashCommandBuilder()
    .setName('cc')
    .setDescription('Custom command management')

    .addSubcommand(s => s.setName('add').setDescription('Add a custom command')
      .addStringOption(o => o.setName('name').setDescription('Command name (without prefix)').setRequired(true))
      .addStringOption(o => o.setName('response').setDescription('Response (supports placeholders)').setRequired(true)))
    .addSubcommand(s => s.setName('remove').setDescription('Remove a custom command')
      .addStringOption(o => o.setName('name').setDescription('Command name').setRequired(true).setAutocomplete(true)))
    .addSubcommand(s => s.setName('list').setDescription('List all custom commands'))
    .addSubcommand(s => s.setName('info').setDescription('View a custom command')
      .addStringOption(o => o.setName('name').setDescription('Command name').setRequired(true).setAutocomplete(true))),

  async autocomplete(interaction) {
    const guildId = interaction.guildId;
    if (!guildId) return;
    const focused = interaction.options.getFocused(true);
    const cmds = db.getCustomCommands(guildId);
    const choices = Object.keys(cmds).filter(c => c.toLowerCase().includes(focused.value.toLowerCase())).slice(0, 25);
    await interaction.respond(choices.map(c => ({ name: c, value: c })));
  },

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'add') {
      const name = interaction.options.getString('name').toLowerCase().replace(/\s+/g, '-');
      const response = interaction.options.getString('response');

      const cmds = db.getCustomCommands(guildId);
      if (Object.keys(cmds).length >= 100) {
        return interaction.reply({ content: '❌ You have reached the limit of 100 custom commands.' });
      }

      db.saveCustomCommand(guildId, name, { response, createdAt: Date.now() });

      return interaction.reply({
        embeds: [botEmbed('#77dd77').setTitle('✅ Custom Command Added')
          .addFields(
            { name: 'Command', value: `/${name}`, inline: true },
            { name: 'Response', value: response.length > 500 ? response.slice(0, 497) + '...' : response },
          )],
      });
    }

    if (sub === 'remove') {
      const name = interaction.options.getString('name').toLowerCase();
      const cmds = db.getCustomCommands(guildId);
      if (!cmds[name]) return interaction.reply({ content: `❌ No custom command named **${name}**.` });

      db.deleteCustomCommand(guildId, name);
      return interaction.reply({ content: `✅ Custom command **${name}** removed.` });
    }

    if (sub === 'list') {
      const cmds = db.getCustomCommands(guildId);
      const keys = Object.keys(cmds);
      if (!keys.length) return interaction.reply({ content: '📭 No custom commands yet. Add one with `/cc add`.' });

      const lines = keys.map(k => `/${k}`);
      const embed = botEmbed().setTitle(`🔧 Custom Commands (${keys.length})`).setDescription(lines.join('\n'));

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'info') {
      const name = interaction.options.getString('name').toLowerCase();
      const cmds = db.getCustomCommands(guildId);
      const data = cmds[name];
      if (!data) return interaction.reply({ content: `❌ No custom command named **${name}**.` });

      return interaction.reply({
        embeds: [botEmbed().setTitle(`🔍 Custom Command: /${name}`)
          .addFields(
            { name: 'Response', value: data.response.length > 1000 ? data.response.slice(0, 997) + '...' : data.response },
            { name: 'Created', value: new Date(data.createdAt).toLocaleString(), inline: true },
          )],
        
      });
    }
  },
};
