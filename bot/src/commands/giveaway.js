const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../database/db');
const { botEmbed } = require('../utils/parser');

module.exports = {
  permissions: ['ManageGuild'],
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Manage giveaways')
    .addSubcommand(s => s.setName('start').setDescription('Start a giveaway')
      .addStringOption(o => o.setName('title').setDescription('Giveaway title').setRequired(true))
      .addStringOption(o => o.setName('description').setDescription('Giveaway description').setRequired(true))
      .addStringOption(o => o.setName('duration').setDescription('Duration e.g. 1h, 2d, 30m').setRequired(true))
      .addChannelOption(o => o.setName('channel').setDescription('Channel to host giveaway (defaults to current)'))
      .addIntegerOption(o => o.setName('winners').setDescription('Number of winners (default 1)').setMinValue(1).setMaxValue(20)))
    .addSubcommand(s => s.setName('end').setDescription('End a giveaway early')
      .addStringOption(o => o.setName('message_id').setDescription('Giveaway message ID').setRequired(true)))
    .addSubcommand(s => s.setName('reroll').setDescription('Reroll a giveaway winner')
      .addStringOption(o => o.setName('message_id').setDescription('Giveaway message ID').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('List active giveaways')),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'start') {
      const title = interaction.options.getString('title');
      const description = interaction.options.getString('description');
      const durStr = interaction.options.getString('duration');
      const channel = interaction.options.getChannel('channel') || interaction.channel;
      const winners = interaction.options.getInteger('winners') || 1;

      const durMs = parseDuration(durStr);
      if (!durMs) return interaction.reply({ content: '❌ Invalid duration. Use e.g. `30m`, `2h`, `1d`.' });

      const endsAt = Date.now() + durMs;
      const embed = new EmbedBuilder()
        .setColor('#f9c4d2')
        .setTitle(title)
        .setDescription(description)
        .addFields(
          { name: 'Ends in:', value: `<t:${Math.floor(endsAt / 1000)}:F> (<t:${Math.floor(endsAt / 1000)}:R>)`, inline: false },
          { name: 'Hosted by:', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Entries:', value: '**0**', inline: true },
          { name: 'Winners:', value: `**${winners}**`, inline: true }
        )
        .setFooter({ text: `Started: ${new Date().toLocaleString()}` })
        .setTimestamp(endsAt);

      const enterBtn = new ButtonBuilder()
        .setCustomId(`gw-enter-${endsAt}`)
        .setLabel('🎉')
        .setStyle(ButtonStyle.Success);

      const row = new ActionRowBuilder().addComponents(enterBtn);

      await interaction.deferReply();
      const msg = await channel.send({ embeds: [embed], components: [row] });

      db.saveGiveaway(guildId, msg.id, {
        title,
        description,
        endsAt,
        channelId: channel.id,
        winners,
        hostId: interaction.user.id,
        hostedBy: interaction.user.username,
        startedAt: Date.now(),
        ended: false,
        entries: []
      });

      return interaction.editReply({ content: `✅ Giveaway started in ${channel}! [Jump to giveaway](${msg.url})` });
    }

    if (sub === 'end') {
      const messageId = interaction.options.getString('message_id');
      const gw = db.getGiveaway(guildId, messageId);
      if (!gw) return interaction.reply({ content: '❌ Giveaway not found.' });
      if (gw.ended) return interaction.reply({ content: '❌ That giveaway already ended.' });

      gw.endsAt = Date.now() - 1;
      db.saveGiveaway(guildId, messageId, gw);
      return interaction.reply({ content: '✅ Giveaway will be ended on the next check cycle (up to 15 seconds).' });
    }

    if (sub === 'reroll') {
      const messageId = interaction.options.getString('message_id');
      const gw = db.getGiveaway(guildId, messageId);
      if (!gw || !gw.ended) return interaction.reply({ content: '❌ Giveaway not found or not yet ended.' });
      if (!interaction.member.permissions.has('ManageGuild') && interaction.user.id !== gw.hostId) {
        return interaction.reply({ content: '❌ Only the host or a manager can reroll.' });
      }

      await interaction.deferReply();
      try {
        const channel = await interaction.guild.channels.fetch(gw.channelId).catch(() => null);
        const message = channel ? await channel.messages.fetch(messageId).catch(() => null) : null;
        const entrants = gw.entries || [];

        if (!entrants.length) return interaction.editReply({ content: '❌ No eligible entries to reroll.' });

        const winner = entrants[Math.floor(Math.random() * entrants.length)];
        await interaction.channel.send({ content: `🎉 **Reroll!** New winner: <@${winner}>! Congratulations!` });
        return interaction.editReply({ content: '✅ Rerolled!' });
      } catch (e) {
        return interaction.editReply({ content: `❌ Reroll failed: ${e.message}` });
      }
    }

    if (sub === 'list') {
      const all = db.getGiveaways(guildId);
      const active = Object.entries(all).filter(([, gw]) => !gw.ended);
      if (!active.length) return interaction.reply({ content: '📭 No active giveaways.' });

      const lines = active.map(([msgId, gw]) => {
        return `• **${gw.title}** — ends <t:${Math.floor(gw.endsAt / 1000)}:R> — ${gw.winners} winner(s) — in <#${gw.channelId}>`;
      });

      return interaction.reply({
        embeds: [botEmbed('#f9c4d2').setTitle(`🎉 Active Giveaways (${active.length})`).setDescription(lines.join('\n'))],
      });
    }
  },
};

function parseDuration(str) {
  const match = str.match(/^(\d+)([smhd])$/i);
  if (!match) return null;
  const [, n, unit] = match;
  const map = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return parseInt(n) * map[unit.toLowerCase()];
}
