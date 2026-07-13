const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } = require('discord.js');

const PER_PAGE = 20;
const MAX_DESC = 4096;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('listemojis')
    .setDescription('List all emojis in this server with their IDs'),

  async execute(interaction) {
    const emojis = [...interaction.guild.emojis.cache.values()]
      .sort((a, b) => a.name.localeCompare(b.name));

    const lines = emojis.map(e => `${e} ⇢ \`${e.animated ? '<a:' : '<:'}${e.name}:${e.id}>\``);
    const totalPages = Math.max(1, Math.ceil(lines.length / PER_PAGE));
    const header = `### 😀 __Emoj__is List\n`;

    function buildPage(page) {
      const pageLines = lines.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
      let desc = `${header}\n${pageLines.join('\n')}`;
      if (desc.length > MAX_DESC) {
        desc = desc.slice(0, MAX_DESC - 3) + '...';
      }
      const embed = new EmbedBuilder()
        .setColor('#9EFFC0')
        .setDescription(desc)
        .setFooter({ text: `Page ${page + 1}/${totalPages} • ${emojis.length} emojis total` });

      const buttons = [];
      if (page > 0) {
        buttons.push(new ButtonBuilder()
          .setCustomId('listemojis:prev')
          .setEmoji('<:a:OwO1:1524863682599977071>')
          .setLabel('Last Page')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(false));
      } else {
        buttons.push(new ButtonBuilder()
          .setCustomId('listemojis:prev')
          .setEmoji('<:a:OwO1:1524863682599977071>')
          .setLabel('Last Page')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true));
      }
      buttons.push(new ButtonBuilder()
        .setCustomId('listemojis:total')
        .setLabel('Total')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true));
      if (page < totalPages - 1) {
        buttons.push(new ButtonBuilder()
          .setCustomId('listemojis:next')
          .setEmoji('<:a:OwO2:1524863704682860836>')
          .setLabel('Next Page')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(false));
      } else {
        buttons.push(new ButtonBuilder()
          .setCustomId('listemojis:next')
          .setEmoji('<:a:OwO2:1524863704682860836>')
          .setLabel('Next Page')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true));
      }

      const rows = [];
      if (buttons.length) rows.push(new ActionRowBuilder().addComponents(buttons));
      return { embeds: [embed], components: rows };
    }

    let currentPage = 0;
    const pagePayload = buildPage(currentPage);
    await interaction.reply({ ...pagePayload, flags: MessageFlags.Ephemeral });
    const msg = await interaction.fetchReply();

    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 300000,
    });

    collector.on('collect', async (btn) => {
      if (btn.user.id !== interaction.user.id) {
        return btn.reply({ content: 'Not your menu.', flags: MessageFlags.Ephemeral });
      }
      if (btn.customId === 'listemojis:prev') currentPage = Math.max(0, currentPage - 1);
      else if (btn.customId === 'listemojis:next') currentPage = Math.min(totalPages - 1, currentPage + 1);
      try {
        await btn.update(buildPage(currentPage));
      } catch {
        try { await interaction.editReply(buildPage(currentPage)); } catch {}
      }
    });

    collector.on('end', async () => {
      try {
        await interaction.editReply({ ...buildPage(currentPage), components: [] });
      } catch {}
    });
  },
};
