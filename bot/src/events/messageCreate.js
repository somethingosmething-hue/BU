const { parseReply, resolveRole } = require('../utils/parser');
const db = require('../database/db');
const { Routes } = require('discord.js');

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        if (message.author.bot || !message.guild) return;

        const guildId = message.guild.id;
        const content = message.content.trim();

        // ── Create Roles Menu (,crm) ───────────────────────────────────────────
        if (content.startsWith(',crm')) {
            if (!message.member.permissions.has('ManageGuild')) {
                await message.reply({ content: '❌ You need Manage Server permission.' }).catch(() => {});
                return;
            }

            const lines = content.split('\n');
            const firstLine = lines[0].trim();

            const crmMatch = firstLine.match(/^,crm\s+(\d+)\s*(?:"([^"]*)")?\s*(?:"([^"]*)")?\s*$/);
            if (!crmMatch) {
                await message.reply({ content: '❌ Invalid format. Use: `,crm [max] "Header" "optional banner URL"\\n@Role emoji\\n@Role`' }).catch(() => {});
                return;
            }

            const maxRoles = parseInt(crmMatch[1]);
            const header = crmMatch[2] || null;
            const bannerUrl = crmMatch[3] || null;

            const roleLines = lines.slice(1).map(l => l.trim()).filter(l => l.length > 0);

            if (roleLines.length === 0) {
                await message.reply({ content: '❌ No roles provided. Add role mentions on new lines after the command.' }).catch(() => {});
                return;
            }

            if (roleLines.length > 25) {
                await message.reply({ content: '❌ Maximum 25 roles allowed in a select menu.' }).catch(() => {});
                return;
            }

            const parsedRoles = [];
            for (const line of roleLines) {
                const roleMatch = line.match(/<@&(\d+)>/);
                if (!roleMatch) {
                    await message.reply({ content: `❌ Could not find a role mention in line: \`${line}\`. Use @role mentions.` }).catch(() => {});
                    return;
                }
                const roleId = roleMatch[1];
                const role = message.guild.roles.cache.get(roleId);
                if (!role) {
                    await message.reply({ content: `❌ Role <@&${roleId}> not found.` }).catch(() => {});
                    return;
                }
                if (role.position >= message.guild.members.me.roles.highest.position) {
                    await message.reply({ content: `❌ I cannot manage **${role.name}** because it is higher than or equal to my highest role.` }).catch(() => {});
                    return;
                }

                const rest = line.replace(roleMatch[0], '').trim();
                let emoji = null;
                if (rest) {
                    const customMatch = rest.match(/^<a?:(\w+):(\d+)>$/);
                    if (customMatch) {
                        emoji = { name: customMatch[1], id: customMatch[2], animated: rest.startsWith('<a:') };
                    } else {
                        const firstToken = rest.split(/\s+/)[0];
                        emoji = { name: firstToken };
                    }
                }

                parsedRoles.push({ roleId, roleName: role.name, emoji });
            }

            const selectCustomId = `crm:${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

            const selectMenu = {
                type: 3,
                custom_id: selectCustomId,
                placeholder: 'Make a selection.',
                min_values: 1,
                max_values: Math.min(maxRoles, parsedRoles.length),
                options: parsedRoles.map(r => {
                    const opt = { label: r.roleName, value: r.roleId };
                    if (r.emoji) opt.emoji = r.emoji;
                    return opt;
                }),
            };

            const containerComponents = [];

            if (header) {
                containerComponents.push({
                    type: 10,
                    content: `## ${header}`,
                });
            }

            const roleListText = parsedRoles
                .map(r => {
                    let emojiText = '';
                    if (r.emoji) {
                        if (r.emoji.id) {
                            emojiText = `<${r.emoji.animated ? 'a' : ''}:${r.emoji.name}:${r.emoji.id}> `;
                        } else {
                            emojiText = `${r.emoji.name} `;
                        }
                    }
                    return `${emojiText}<@&${r.roleId}>`;
                })
                .join('\n');

            if (header) {
                containerComponents.push({ type: 14, spacing: 2, divider: true });
            }

            containerComponents.push({ type: 10, content: roleListText });
            containerComponents.push({ type: 10, content: `-# Max selection: **${maxRoles}** roles` });
            containerComponents.push({ type: 14, spacing: 2, divider: true });
            containerComponents.push({
                type: 1,
                components: [selectMenu],
            });

            const components = [];

            if (bannerUrl) {
                components.push({
                    type: 12,
                    items: [{ media: { url: bannerUrl } }],
                });
                components.push({ type: 14, spacing: 2, divider: true });
            }

            components.push({
                type: 17,
                components: containerComponents,
            });

            try {
                await message.delete().catch(() => {});
                await client.rest.post(Routes.channelMessages(message.channel.id), {
                    body: { flags: 1 << 15, allowed_mentions: { parse: [] }, components },
                });
            } catch (e) {
                console.error('[crm] Failed to send role menu:', e.message);
                await message.channel.send({ content: `❌ Failed to create role menu: ${e.message}` }).catch(() => {});
            }

            return;
        }

        // ── CurList Channel Processing ────────────────────────────────────────
        const settings = await db.getServerSettings(guildId);
        const curlistChannelId = settings?.curlistChannel;

        if (curlistChannelId && message.channel.id === curlistChannelId) {
            const addMatch = content.match(/^\[ADD:\s*([^\]]+)\]\s*\n?/i);
            if (addMatch) {
                const listName = addMatch[1].trim();
                const body = content.slice(addMatch[0].length).trim();
                const elements = body.split('\n').map(line => line.trim()).filter(line => line.length > 0);

                if (elements.length > 0) {
                    await db.addCurListElements(guildId, listName, elements);
                    await message.reply({ content: `✅ Added ${elements.length} element(s) to list "${listName}".`, flags: 64 }).catch(() => {});
                } else {
                    await message.reply({ content: `No elements found to add to "${listName}".`, flags: 64 }).catch(() => {});
                }
                return;
            }

            // Global CurList - requires global trust
            const gaddMatch = content.match(/^\[GADD:\s*([^\]]+)\]\s*\n?/i);
            if (gaddMatch) {
                const listName = gaddMatch[1].trim();
                if (!db.isGloballyTrusted(message.author.id)) {
                    await message.reply({ content: '❌ You are not globally trusted to use GADD.', flags: 64 }).catch(() => {});
                    return;
                }
                const body = content.slice(gaddMatch[0].length).trim();
                const elements = body.split('\n').map(line => line.trim()).filter(line => line.length > 0);

                if (elements.length > 0) {
                    await db.addGlobalCurListElements(listName, elements);
                    await message.reply({ content: `🌐 Added ${elements.length} element(s) to global list "${listName}".`, flags: 64 }).catch(() => {});
                } else {
                    await message.reply({ content: `No elements found to add to "${listName}".`, flags: 64 }).catch(() => {});
                }
                return;
            }
        }

        // ── Custom Commands (prefix-based) ────────────────────────────────────
        const rawPrefix = await db.getPrefix(guildId);
        if (rawPrefix && typeof rawPrefix !== 'string') {
          console.error('Invalid prefix type:', typeof rawPrefix, rawPrefix);
        }
        const prefix = (typeof rawPrefix === 'string' && rawPrefix) ? rawPrefix : null;

        if (prefix && content.toLowerCase().startsWith(prefix.toLowerCase())) {
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
                    try {
                      if (trigger.length > 200) { matched = false; break; }
                      const re = new RegExp(trigger, 'i');
                      matched = re.test(content);
                    } catch { matched = false; }
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
