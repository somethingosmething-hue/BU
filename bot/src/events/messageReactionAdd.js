const { parseReply, resolveRole } = require('../utils/parser');
const db = require('../database/db');

module.exports = {
    name: 'messageReactionAdd',
    async execute(reaction, user, client) {
        if (user.bot) return;

        // Handle partial reactions (messages not in cache)
        if (reaction.partial) {
            try { await reaction.fetch(); } catch { return; }
        }

        const guild = reaction.message.guild;
        if (!guild) return;

        const guildId   = guild.id;
        const messageId = reaction.message.id;
        const emojiStr  = reaction.emoji.id
            ? `<:${reaction.emoji.name}:${reaction.emoji.id}>`   // custom emoji
            : reaction.emoji.toString();                          // unicode emoji

        // ── Reaction Roles ────────────────────────────────────────────────────
        // Check both the resolved emoji string and the raw name (unicode fallback)
        const roleId = db.getReactionRole(guildId, messageId, emojiStr)
                    || db.getReactionRole(guildId, messageId, reaction.emoji.name);

        if (roleId) {
            const member = await guild.members.fetch(user.id).catch(() => null);
            if (!member) return;
            const role = guild.roles.cache.get(roleId);
            if (!role) return;
            try {
                await member.roles.add(role);
            } catch (e) {
                console.error('[reactionrole] Failed to add role:', e.message);
            }
            return;
        }

        // ── Reaction Event Triggers ───────────────────────────────────────────
        const trigger = db.getReactionTrigger(guildId, messageId, emojiStr)
                     || db.getReactionTrigger(guildId, messageId, reaction.emoji.name);

        if (!trigger) return;

        const member = await guild.members.fetch(user.id).catch(() => null);
        if (!member) return;

        const context = { member, guild, guildId, user };
        const parsed = await parseReply(trigger.response, context);

        if (parsed.requireRole) {
            const role = resolveRole(guild, parsed.requireRole);
            if (role && !member.roles.cache.has(role.id)) return;
        }

        for (const action of parsed.actions) {
            if (action.type === 'addrole' || action.type === 'removerole') {
                const role = resolveRole(guild, action.value);
                if (!role) continue;
                try {
                    if (action.type === 'addrole')    await member.roles.add(role);
                    if (action.type === 'removerole') await member.roles.remove(role);
                } catch (e) { console.error('Role action failed:', e.message); }
            }
        }

        const channel = reaction.message.channel;

        if (trigger.action === 'add_role' && trigger.role) {
            const role = resolveRole(guild, trigger.role);
            if (role) try { await member.roles.add(role); } catch {}
        } else if (trigger.action === 'remove_role' && trigger.role) {
            const role = resolveRole(guild, trigger.role);
            if (role) try { await member.roles.remove(role); } catch {}
        } else {
            // reply / send
            const payload = {};
            if (parsed.text)        payload.content    = parsed.text;
            if (parsed.embed)       payload.embeds     = [parsed.embed];
            if (parsed.rows.length) payload.components = parsed.rows;
            if (!Object.keys(payload).length) return;

            const targetChannel = (trigger.action === 'send' && trigger.channelId)
                ? guild.channels.cache.get(trigger.channelId)
                : channel;

            if (targetChannel) await targetChannel.send(payload).catch(console.error);
        }
    },
};
