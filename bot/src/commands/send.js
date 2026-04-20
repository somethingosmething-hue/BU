const { SlashCommandBuilder } = require('discord.js');
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
