const { parseReply, resolveRole } = require('../utils/parser');
const db = require('../database/db');

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        if (message.author.bot || !message.guild) return;

        const guildId = message.guild.id;
        const content = message.content.trim();

        // ── Custom Commands (prefix-based) ────────────────────────────────────
        const prefix = (await db.getPrefix(guildId)) || '/';

        if (content.toLowerCase().startsWith(prefix.toLowerCase())) {
            const cmdContent = content.slice(prefix.length).trim();
            const cmdName    = cmdContent.split(' ')[0].toLowerCase();
            const args       = cmdContent.slice(cmdName.length).trim();

            const customCommands = await db.getCustomCommands(guildId);
            const cmdData        = customCommands[cmdName];

            if (cmdData) {
                const context = {
                    member: message.member,
                    guild:  message.guild,
                    guildId,
                    message,
                    user: message.author,
                    args,
                };

                const parsed = await parseReply(cmdData.response, context);

                if (parsed.requireRole) {
                    const role = resolveRole(message.guild, parsed.requireRole);
                    if (role && !message.member.roles.cache.has(role.id)) {
                        await message.reply({ content: `❌ You need the **${role.name}** role!` }).catch(() => {});
                        return;
                    }
                }

                for (const action of parsed.actions) {
                    const role = resolveRole(message.guild, action.value);
                    if (!role) continue;
                    try {
                        if (action.type === 'addrole')    await message.member.roles.add(role);
                        if (action.type === 'removerole') await message.member.roles.remove(role);
                    } catch (e) { console.error('Role action failed:', e.message); }
                }

                const payload = {};
                if (parsed.text)        payload.content    = parsed.text;
                if (parsed.embed)       payload.embeds     = [parsed.embed];
                if (parsed.rows.length) payload.components = parsed.rows;

                if (Object.keys(payload).length > 0) {
                    await message.reply(payload).catch(console.error);
                    for (const emoji of parsed.reactEmojis) {
                        await message.react(emoji).catch(() => {});
                    }
                }

                return; // matched a custom command — don't also check autoresponders
            }
        }

        // ── Autoresponders ────────────────────────────────────────────────────
        // Runs on every message regardless of prefix.
        const autoresponders = await db.getAutoresponders(guildId);

        for (const [trigger, data] of Object.entries(autoresponders)) {
            let matched = false;
            const lowerContent = content.toLowerCase();
            const lowerTrigger = trigger.toLowerCase();

            switch (data.matchType) {
                case 'exact':
                    matched = lowerContent === lowerTrigger;
                    break;
                case 'contains':
                    matched = lowerContent.includes(lowerTrigger);
                    break;
                case 'startsWith':
                    matched = lowerContent.startsWith(lowerTrigger);
                    break;
                case 'endsWith':
                    matched = lowerContent.endsWith(lowerTrigger);
                    break;
                case 'regex':
                    try { matched = new RegExp(trigger, 'i').test(content); } catch { matched = false; }
                    break;
                default:
                    matched = lowerContent === lowerTrigger; // fallback to exact
            }

            if (!matched) continue;

            // Channel restriction
            if (data.channelId && message.channel.id !== data.channelId) continue;

            // Cooldown
            if (data.cooldown) {
                const last = await db.getCooldown(guildId, message.author.id, trigger);
                if (last && Date.now() - last < data.cooldown * 1000) {
                    const remaining = Math.ceil((data.cooldown * 1000 - (Date.now() - last)) / 1000);
                    await message.reply({ content: `⏳ Cooldown! Try again in **${remaining}s**.` }).catch(() => {});
                    return;
                }
                await db.setCooldown(guildId, message.author.id, trigger, Date.now());
            }

            const context = {
                member: message.member,
                guild:  message.guild,
                guildId,
                message,
                user: message.author,
            };

            const parsed = await parseReply(data.reply, context);

            if (parsed.requireRole) {
                const role = resolveRole(message.guild, parsed.requireRole);
                if (role && !message.member.roles.cache.has(role.id)) {
                    await message.reply({ content: `❌ You need the **${role.name}** role!` }).catch(() => {});
                    return;
                }
            }

            for (const action of parsed.actions) {
                const role = resolveRole(message.guild, action.value);
                if (!role) continue;
                try {
                    if (action.type === 'addrole')    await message.member.roles.add(role);
                    if (action.type === 'removerole') await message.member.roles.remove(role);
                } catch (e) { console.error('Role action failed:', e.message); }
            }

            const payload = {};
            if (parsed.text)        payload.content    = parsed.text;
            if (parsed.embed)       payload.embeds     = [parsed.embed];
            if (parsed.rows.length) payload.components = parsed.rows;

            if (Object.keys(payload).length > 0) {
                // Default is 'send'; only reply if sendType is explicitly 'reply'
                if (data.sendType === 'reply') {
                    await message.reply(payload).catch(console.error);
                } else {
                    await message.channel.send(payload).catch(console.error);
                }
            }

            for (const emoji of parsed.reactEmojis) {
                await message.react(emoji).catch(() => {});
            }

            break; // stop at first matching autoresponder
        }
    },
};
