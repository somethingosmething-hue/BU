const { SlashCommandBuilder, ChannelType } = require('discord.js');
const { parseReply } = require('../utils/parser');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('send')
    .setDescription('Send a message with variables and embeds support')
    .addStringOption(o => o.setName('message').setDescription('Message to send (supports variables)').setRequired(true))
    .addChannelOption(o => o.setName('channel').setDescription('Channel to send to (defaults to current)'))
    .addBooleanOption(o => o.setName('embed').setDescription('Send as embed?')),

  async execute(interaction, client) {
    const message = interaction.options.getString('message');
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const asEmbed = interaction.options.getBoolean('embed') || false;

    const context = {
      member: interaction.member,
      guild: interaction.guild,
      guildId: interaction.guildId,
      user: interaction.user,
    };

    const parsed = await parseReply(message, context);

    const payload = {};

    // ── Check if any separators (type 14) are present in rows ──────────────
    const hasSeparator = parsed.rows?.some(c => c.type === 14);

    if (hasSeparator) {
      // Components V2 mode — content must live inside a Text Display component
      payload.flags = 1 << 15; // IS_COMPONENTS_V2 = 32768

      const topLevel = [];

      // Convert text/embed content into a Text Display component (type 10)
      if (asEmbed && parsed.text) {
        // Embeds aren't supported in Components V2 — fall back to text display
        topLevel.push({ type: 10, content: parsed.text });
      } else if (parsed.text) {
        topLevel.push({ type: 10, content: parsed.text });
      }

      // Append all rows (separators + action rows) in order
      topLevel.push(...parsed.rows);

      payload.components = topLevel;

    } else {
      // ── Normal (non-Components V2) mode ──────────────────────────────────

      if (asEmbed && parsed.text) {
        const { EmbedBuilder } = require('discord.js');
        payload.embeds = [new EmbedBuilder().setColor('#5865F2').setDescription(parsed.text)];
        payload.content = null;
      } else if (parsed.text) {
        payload.content = parsed.text;
      }

      if (parsed.embed && !asEmbed) {
        payload.embeds = [parsed.embed];
      }

      if (parsed.rows?.length) {
        payload.components = parsed.rows;
      }
    }

    await channel.send(payload);

    for (const emoji of parsed.reactEmojis || []) {
      try {
        const sent = await channel.send({ content: emoji });
        await sent.delete();
      } catch {}
    }

    await interaction.reply({ content: `✅ Sent to ${channel}`, ephemeral: true });
  },
};
