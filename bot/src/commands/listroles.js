const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

const PER_PAGE = 20;
const MAX_DESC = 4096;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('listroles')
    .setDescription('List all roles in this server with their IDs'),

  async execute(interaction) {
    const roles = [...interaction.guild.roles.cache.values()]
      .sort((a, b) => b.position - a.position);

    const lines = roles.map(r => `<@&${r.id}> ⇢ ${r.id}`);
    const totalPages = Math.max(1, Math.ceil(lines.length / PER_PAGE));
    const header = `### <:longcat1:1524864921051857137><:longcat2:1524864957450293378><:longcat3:1524865004799791164> __Rol__es List\n`;

    function buildPage(page) {
      const pageLines = lines.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
      let desc = `${header}\n${pageLines.join('\n')}`;
      if (desc.length > MAX_DESC) {
        desc = desc.slice(0, MAX_DESC - 3) + '...';
      }
      const embed = new EmbedBuilder()
        .setColor('#9EFFC0')
        .setDescription(desc)
        .setFooter({ text: `Page ${page + 1}/${totalPages} • ${roles.length} roles total` });

      const buttons = [];
      if (page > 0) {
        buttons.push(new ButtonBuilder()
          .setCustomId('listroles:prev')
          .setEmoji('<:a:OwO1:1524863682599977071>')
          .setLabel('Last Page')
          .setStyle(ButtonStyle.Secondary));
      }
      buttons.push(new ButtonBuilder()
        .setCustomId('listroles:total')
        .setLabel('Total')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true));
      if (page < totalPages - 1) {
        buttons.push(new ButtonBuilder()
          .setCustomId('listroles:next')
          .setEmoji('<:a:OwO2:1524863704682860836>')
          .setLabel('Next Page')
          .setStyle(ButtonStyle.Secondary));
      }

      const rows = [];
      if (buttons.length) rows.push(new ActionRowBuilder().addComponents(buttons));
      return { embeds: [embed], components: rows };
    }

    let currentPage = 0;
    await interaction.reply({ ...buildPage(currentPage), ephemeral: true });
    const msg = await interaction.fetchReply();

    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 300000,
    });

    collector.on('collect', async (btn) => {
      if (btn.user.id !== interaction.user.id) {
        return btn.reply({ content: 'Not your menu.', ephemeral: true });
      }
      if (btn.customId === 'listroles:prev') currentPage = Math.max(0, currentPage - 1);
      else if (btn.customId === 'listroles:next') currentPage = Math.min(totalPages - 1, currentPage + 1);
      await btn.update(buildPage(currentPage));
    });

    collector.on('end', async () => {
      try {
        await interaction.editReply({ components: [...buildPage(currentPage).components, { type: 14, divider: true }] });
        await interaction.editReply({ components: [] });
      } catch {}
    });
  },
};
