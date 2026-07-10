const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { parseReply, resolveRole } = require('../utils/parser');
const db = require('../database/db');

async function findBusiestChannel(guild) {
  let busiest = null;
  let bestTimestamp = 0;
  try { await guild.channels.fetch(); } catch {}
  const textChannels = guild.channels.cache.filter(c => c.type === 0);
  for (const [, channel] of textChannels) {
    if (channel.lastMessageId) {
      try {
        const ts = Number(BigInt(channel.lastMessageId) >> 22n);
        if (ts > bestTimestamp) {
          bestTimestamp = ts;
          busiest = channel;
        }
      } catch {}
    }
  }
  return busiest;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Send a message to the most active channel in every guild (global trusted only)')
    .addStringOption(o => o.setName('message').setDescription('Message to announce (supports variables)').setRequired(true))
    .addBooleanOption(o => o.setName('embed').setDescription('Send as embed?')),

  async execute(interaction, client) {
    if (!db.isGloballyTrusted(interaction.user.id)) {
      return interaction.reply({ content: '❌ You must be globally trusted to use this command.', flags: 64 });
    }

    const messageText = interaction.options.getString('message');
    const asEmbed = interaction.options.getBoolean('embed') || false;

    await interaction.deferReply({ flags: 64 });

    const context = {
      member: interaction.member,
      guild: interaction.guild,
      guildId: interaction.guildId,
      user: interaction.user,
    };

    const parsed = await parseReply(messageText, context);

    if (parsed.requireRole) {
      const role = resolveRole(interaction.guild, parsed.requireRole);
      if (role && !interaction.member.roles.cache.has(role.id)) {
        return interaction.editReply({ content: `❌ You need the **${role.name}** role!` });
      }
    }

    const buildPayload = () => {
      const payload = {};
      if (parsed.hasSeparators) {
        payload.content = parsed.text || ' ';
        payload.flags = 32768;
        payload.components = parsed.componentRows;
      } else {
        if (asEmbed && parsed.text) {
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
      return payload;
    };

    let sent = 0;
    let failed = 0;

    for (const [guildId, guild] of client.guilds.cache) {
      try {
        const channel = await findBusiestChannel(guild);
        if (!channel) { failed++; continue; }

        const guildContext = {
          member: guild.members.cache.get(interaction.user.id),
          guild,
          guildId,
          user: interaction.user,
        };
        const guildParsed = await parseReply(messageText, guildContext);

        const payload = {};
        if (guildParsed.hasSeparators) {
          payload.content = guildParsed.text || ' ';
          payload.flags = 32768;
          payload.components = guildParsed.componentRows;
        } else {
          if (asEmbed && guildParsed.text) {
            payload.embeds = [new EmbedBuilder().setColor('#5865F2').setDescription(guildParsed.text)];
          } else if (guildParsed.text) {
            payload.content = guildParsed.text;
          }
          if (guildParsed.embed && !asEmbed) {
            payload.embeds = [guildParsed.embed];
          }
          if (guildParsed.rows?.length) {
            payload.components = guildParsed.rows;
          }
        }

        const sentMsg = await channel.send(payload);
        for (const emoji of guildParsed.reactEmojis || []) {
          try { await sentMsg.react(emoji); } catch {}
        }
        sent++;
      } catch (e) {
        console.error(`Announce failed for guild ${guildId}:`, e.message);
        failed++;
      }
    }

    return interaction.editReply({ content: `✅ Announced to **${sent}** guild(s)${failed ? `, ${failed} failed` : ''}.` });
  },
};
