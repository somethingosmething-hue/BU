const db = require('../database/db');

module.exports = {
    name: 'guildMemberRemove',
    async execute(member, client) {
        const guildId = member.guild.id;
        const userId = member.id;

        try {
            const active = await db.getActiveGiveawaysByGuild(guildId);
            const affected = active.filter(gw => (gw.entrants || []).includes(userId));
            if (!affected.length) return;

            const { updateGiveawayParticipantCount } = require('./giveawayHandler');

            for (const gw of affected) {
                await db.removeGiveawayEntrant(guildId, gw.messageId, userId);
            }
            for (const gw of affected) {
                const fresh = await db.getActiveGiveaway(guildId, gw.messageId);
                if (!fresh) continue;
                const newCount = (fresh.entrants || []).length;
                if (fresh.originalPayload) {
                    await updateGiveawayParticipantCount(client, fresh, newCount).catch(() => {});
                }
            }
        } catch (e) {
            console.error('[Giveaway] guildMemberRemove error:', e);
        }
    },
};
