const db = require('../database/db');

function buildThreadName(message) {
  const raw = (message.content || '').replace(/\s+/g, ' ').trim();
  const author = message.author?.username || 'Discussion';
  let base = raw ? raw.slice(0, 80) : `Discussion with ${author}`;
  // Discord thread names: 1-100 chars, cannot be empty
  if (!base) base = `Thread - ${author}`;
  return base.slice(0, 100);
}

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    try {
      if (!message.guild) return;
      if (message.author?.bot) return;
      if (message.system) return;
      if (!message.channel || !message.channel.id) return;

      // Only top-level guild text / announcement channels — never threads.
      if (typeof message.channel.isThread === 'function' && message.channel.isThread()) return;
      // Thread channels have parentId; ChannelType GuildPublicThread=11, Private=12, AnnouncementThread=10
      if ([10, 11, 12].includes(message.channel.type)) return;

      // Don't double-thread a message that already has one.
      if (message.hasThread || message.thread) return;

      const guildId = message.guild.id;
      const enabled = await db.isAutoThreadChannel(guildId, message.channel.id).catch(() => false);
      if (!enabled) return;

      // Need permission to create threads; fail silently if missing.
      try {
        const me = message.guild.members.me;
        const perms = message.channel.permissionsFor(me);
        if (perms && !perms.has('CreatePublicThreads')) return;
      } catch {}

      const name = buildThreadName(message);

      try {
        await message.startThread({
          name,
          autoArchiveDuration: 1440,
          reason: 'Auto-thread',
        });
      } catch (e) {
        // 1440m archive may be unavailable on low-boost servers — retry with 60m.
        if (e?.code === 50035 || /autoArchiveDuration/i.test(e?.message || '')) {
          try {
            await message.startThread({ name, autoArchiveDuration: 60, reason: 'Auto-thread' });
          } catch {}
        }
      }
    } catch (e) {
      console.error('[autothread] error:', e?.message || e);
    }
  },
};
