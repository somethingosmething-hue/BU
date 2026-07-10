const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const db = require('../database/db');

const PER_PAGE = 5;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('listnotes')
    .setDescription('List all glued messages in this server')
    .addBooleanOption(o =>
      o.setName('show_glued_by')
        .setDescription('Show who glued each message')
        .setRequired(false)
    ),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const notes = await db.getAllNotes(guildId);
    if (!notes.length) {
      return interaction.reply({ content: '📭 No notes found in this server.', flags: 64 });
    }

    const showGluedBy = interaction.options.getBoolean('show_glued_by') || false;
    const canShowUsers = showGluedBy && interaction.member.permissions.has('Administrator');

    const pages = [];
    for (let i = 0; i < notes.length; i += PER_PAGE) {
      const chunk = notes.slice(i, i + PER_PAGE);
      const lines = chunk.map(n => {
        const chan = interaction.guild.channels.cache.get(n.channelId);
        const channelName = chan ? chan.toString() : `#deleted-channel`;
        const preview = n.type === 'embed' ? (n.title || '(embed)') : (n.content || '').slice(0, 80);
        let line = `📌 ${channelName}: ${preview}`;
        if (canShowUsers) {
          line += `\n<@${n.gluedBy}>`;
        }
        return line;
      });
      pages.push(lines.join('\n\n'));
    }

    let page = 0;
    const embed = new EmbedBuilder()
      .setColor('#BE74E3')
      .setTitle(`📋 Notes in ${interaction.guild.name}`)
      .setDescription(pages[0])
      .setFooter({ text: `Page ${page + 1}/${pages.length}` });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('prev').setLabel('◀ Previous').setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId('next').setLabel('Next ▶').setStyle(ButtonStyle.Secondary).setDisabled(pages.length <= 1)
    );

    const reply = await interaction.reply({ embeds: [embed], components: [row], flags: 64 });

    if (pages.length <= 1) return;

    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 300000,
    });

    collector.on('collect', async (btn) => {
      if (btn.user.id !== interaction.user.id) {
        return btn.reply({ content: '❌ Not your button.', flags: 64 });
      }
      page = btn.customId === 'next' ? page + 1 : page - 1;

      embed.setDescription(pages[page]).setFooter({ text: `Page ${page + 1}/${pages.length}` });

      const prevBtn = new ButtonBuilder().setCustomId('prev').setStyle(ButtonStyle.Secondary).setLabel('◀ Previous').setDisabled(page === 0);
      const nextBtn = new ButtonBuilder().setCustomId('next').setStyle(ButtonStyle.Secondary).setLabel('Next ▶').setDisabled(page === pages.length - 1);

      await btn.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(prevBtn, nextBtn)] });
    });
  },
};