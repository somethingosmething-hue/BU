const db = require('../database/db');
const giveaway = require('../giveaway');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member, client) {
    const guildId = member.guild.id;
    const userId = member.id;

    try {
      const sent = await db.getGiveaways(guildId);
      for (const [msgId, gw] of Object.entries(sent)) {
        if (!gw || !Array.isArray(gw.entries) || !gw.entries.includes(userId)) continue;

        gw.entries = gw.entries.filter(id => id !== userId);
        await db.saveGiveaway(guildId, msgId, gw);

        await giveaway.updateParticipantCount(client, gw, msgId);
      }
    } catch (e) {
      console.error('guildMemberRemove giveaway cleanup error:', e.message);
    }
  },
};
