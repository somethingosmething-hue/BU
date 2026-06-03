const { SlashCommandBuilder, InteractionContextType } = require('discord.js');
const db = require('../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('etotalnumcurlist')
    .setDescription('Show how many elements each global curlist has')
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel),
  async execute(interaction) {
    const user = interaction.user;

    if (!db.isGloballyTrusted(user.id)) {
      return interaction.reply({ content: '❌ You are not globally trusted to use this command.', ephemeral: true });
    }

    const lists = await db.getAllGlobalCurLists();

    if (!lists || lists.length === 0) {
      return interaction.reply({ content: 'No global curlists found.', ephemeral: true });
    }

    const lines = lists.map(l => `• **${l.name}** — **${l.elements.length}** element(s)`);
    await interaction.reply({
      content: `📊 **Global CurList Totals:**\n${lines.join('\n')}`,
      ephemeral: true,
    });
  },
};
