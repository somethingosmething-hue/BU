const { SlashCommandBuilder } = require('discord.js');
const { parseReply, resolveRole } = require('../utils/parser');

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

    if (parsed.requireRole) {
        const role = resolveRole(interaction.guild, parsed.requireRole);
        if (role && !interaction.member.roles.cache.has(role.id)) {
            await interaction.reply({ content: `❌ You need the **${role.name}** role!`, ephemeral: true });
            return;
        }
    }

    const payload = {};

    if (parsed.hasSeparators) {
      // Components V2 mode - requires flag 32768 (1 << 15)
      payload.content = parsed.text || ' ';
      payload.flags = 32768;
      payload.components = parsed.componentRows;
    } else {
      // Normal mode
      if (asEmbed && parsed.text) {
        const { EmbedBuilder } = require('discord.js');
        payload.embeds = [new EmbedBuilder().setColor('#5865F2').setDescription(parsed.text)];
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