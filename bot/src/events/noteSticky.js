const { EmbedBuilder } = require('discord.js');
const db = require('../database/db');

const _recentSticky = new Set();

async function refreshNote(guildId, channel, note) {
  const key = `${guildId}:${channel.id}`;
  _recentSticky.add(key);
  setTimeout(() => _recentSticky.delete(key), 2000);

  if (!note.messageId) return;

  try {
    const old = await channel.messages.fetch(note.messageId).catch(() => null);
    if (old) await old.delete().catch(() => {});
  } catch {}

  let msg;
  if (note.type === 'embed') {
    const embed = new EmbedBuilder()
      .setColor(note.color || '#66C2FF');
    if (note.title) embed.setTitle(note.title);
    if (note.description) embed.setDescription(note.description);
    if (note.thumbnail) embed.setThumbnail(note.thumbnail);
    if (note.image) embed.setImage(note.image);
    msg = await channel.send({ embeds: [embed], flags: 1 << 12 });
  } else {
    msg = await channel.send({
      content: note.content || '',
      flags: (note.suppress ? 1 << 2 : 0) | (1 << 12),
    });
  }

  note.messageId = msg.id;
  note.channelId = channel.id;
  await db.saveNote(note.guildId, note.channelId, note);
}

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    if (!message.guild) return;

    const key = `${message.guild.id}:${message.channel.id}`;
    if (_recentSticky.has(key)) return;

    const note = await db.getNote(message.guild.id, message.channel.id);
    if (!note) return;

    if (note.messageId && message.id === note.messageId) return;

    await refreshNote(message.guild.id, message.channel, note);
  },
  refreshNote,
};
