const db = require('../database/db');
const { parseReply } = require('../utils/parser');

module.exports = {
  name: 'guildMemberUpdate',
  async execute(oldMember, newMember, client) {
    if (oldMember.premiumSince || !newMember.premiumSince) return;

    const guildId = newMember.guild.id;
    const settings = await db.getServerSettings(guildId);
    const channelId = settings.boostChannel;
    const messageTemplate = settings.boostMessage;

    if (!channelId || !messageTemplate) return;

    const channel = newMember.guild.channels.cache.get(channelId);
    if (!channel) return;

    const context = {
      member: newMember,
      guild: newMember.guild,
      guildId,
      user: newMember.user,
      message: null,
    };

    const parsed = await parseReply(messageTemplate, context);

    const payload = {};
    if (parsed.text) payload.content = parsed.text;
    if (parsed.embed) payload.embeds = [parsed.embed];
    if (parsed.rows.length) payload.components = parsed.rows;

    if (Object.keys(payload).length > 0) {
      await channel.send(payload).catch(e => console.error('Boost message send error:', e.message));
    }
  },
};
