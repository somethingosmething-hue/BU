const { SlashCommandBuilder, InteractionContextType } = require('discord.js');
const db = require('../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('enumcurlist')
    .setDescription('Show how many elements are in a global curlist')
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel)
    .addStringOption(opt =>
      opt.setName('name')
        .setDescription('Name of the global curlist')
        .setRequired(true)
    ),
  async execute(interaction) {
    const user = interaction.user;

    // Check if user is globally trusted
    if (!db.isGloballyTrusted(user.id)) {
      return interaction.reply({ content: '❌ You are not globally trusted to use this command.', ephemeral: true });
    }

    const name = interaction.options.getString('name');
    const curlist = await db.getGlobalCurList(name);

    if (!curlist || curlist.elements.length === 0) {
      return interaction.reply({ content: `No elements found in global list "${name}".`, ephemeral: true });
    }

    await interaction.reply({ content: `🌐 **${name}** has **${curlist.elements.length}** element(s).`, ephemeral: true });
  },
};
