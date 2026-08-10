const { parseReply, resolveRole } = require('../utils/parser');
const db = require('../database/db');
const leveling = require('../utils/leveling');
const { Routes } = require('discord.js');

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        if (message.author.bot || !message.guild) return;

        const guildId = message.guild.id;
        const content = message.content.trim();

        // ── Leveling XP ──────────────────────────────────────────────────────
        try {
            await leveling.processMessageXp(message, client);
        } catch (e) {
            console.error('[levels] XP processing error:', e.message);
        }

        // ── Create Roles Menu (,crm) ───────────────────────────────────────────
        if (content.startsWith(',crm')) {
            if (!message.member.permissions.has('ManageGuild')) {
                await message.reply({ content: '❌ You need Manage Server permission.' }).catch(() => {});
                return;
            }

            const lines = content.split('\n');
            const firstLine = lines[0].trim();

            const crmMatch = firstLine.match(/^,crm\s+(\d+)\s*(true\s+)?(?:"([^"]*)")?\s*(?:"([^"]*)")?\s*$/);
            if (!crmMatch) {
                await message.reply({ content: '❌ Invalid format. Use: `,crm [max] "Header" "optional banner URL"\\n@Role emoji\\n@Role`' }).catch(() => {});
                return;
            }

            const maxRoles = parseInt(crmMatch[1]);
            const addSpacers = !!crmMatch[2];
            const header = crmMatch[3] || null;
            const bannerUrl = crmMatch[4] || null;

            const rawLines = lines.slice(1).map(l => l.trim()).filter(l => l.length > 0);
            const specLines = rawLines.filter(l => /^spec:/i.test(l));
            const roleLines = rawLines.filter(l => !/^spec:/i.test(l));

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
                        let firstToken = rest.split(/\s+/)[0];
                        firstToken = firstToken.replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF\u00AD]/g, '');
                        if (firstToken.length === 0) {
                        } else if (firstToken.startsWith(':') && firstToken.endsWith(':') && firstToken.length > 2) {
                            const shortcode = firstToken.slice(1, -1);
                            const guildEmoji = message.guild.emojis.cache.find(e => e.name === shortcode);
                            if (guildEmoji) {
                                emoji = { name: guildEmoji.name, id: guildEmoji.id, animated: guildEmoji.animated };
                            } else {
                                const unicodeEmojiRegex = /^(\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Emoji}\uFE0F)(\u200D\p{Emoji})*(\uFE0F)?$/u;
                                if (unicodeEmojiRegex.test(firstToken)) emoji = { name: firstToken };
                            }
                        } else {
                            const unicodeEmojiRegex = /^(\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Emoji}\uFE0F)(\u200D\p{Emoji})*(\uFE0F)?$/u;
                            if (unicodeEmojiRegex.test(firstToken)) emoji = { name: firstToken };
                        }
                    }
                }

                parsedRoles.push({ roleId, roleName: role.name, emoji });
            }

            // ── Parse spec lines ────────────────────────────────────────────────
            const specs = { disallow: { type: null, messageLink: null, targetCustomId: null, targetRoleIds: null }, requires: { type: null, roleIds: null }, run: { delroles: false, recheck: false }, customize: { lim: null, error: null } };
            for (const spec of specLines) {
                if (spec.startsWith('spec:disallow:')) {
                    const val = spec.slice('spec:disallow:'.length).trim();
                    if (val === 'all') specs.disallow.type = 'all';
                    else if (val.startsWith('http')) {
                        specs.disallow.type = 'link';
                        specs.disallow.messageLink = val;
                        const linkMatch = val.match(/https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/);
                        if (linkMatch) {
                            const targetMenu = await db.getCRMMenuByMessage(linkMatch[2], linkMatch[3]);
                            if (targetMenu) {
                                specs.disallow.targetCustomId = targetMenu._id;
                                specs.disallow.targetRoleIds = targetMenu.roleIds;
                            }
                        }
                    }
                } else if (spec.startsWith('spec:requires:')) {
                    const val = spec.slice('spec:requires:'.length).trim();
                    if (val === 'booster') specs.requires.type = 'booster';
                    else if (val === 'administrator') specs.requires.type = 'administrator';
                    else if (val.includes('+')) { specs.requires.type = 'all-roles'; specs.requires.roleIds = val.split('+').map(s => s.trim()).filter(Boolean); }
                    else if (val.includes('/')) { specs.requires.type = 'any-roles'; specs.requires.roleIds = val.split('/').map(s => s.trim()).filter(Boolean); }
                    else { specs.requires.type = 'role'; specs.requires.roleIds = [val.trim()]; }
                } else if (spec.startsWith('spec:run:delroles')) specs.run.delroles = true;
                else if (spec.startsWith('spec:run:recheck')) specs.run.recheck = true;
                else if (spec.startsWith('spec:customize:lim:')) {
                    const num = parseInt(spec.slice('spec:customize:lim:'.length).trim());
                    if (!isNaN(num) && num > 0) specs.customize.lim = Math.min(num, 25);
                } else if (spec.startsWith('spec:customize:error:')) {
                    specs.customize.error = spec.slice('spec:customize:error:'.length).trim();
                }
            }

            const visibleLimit = specs.customize.lim || 12;

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

            const visibleRoles = parsedRoles.length > visibleLimit ? parsedRoles.slice(0, visibleLimit) : parsedRoles;

            const roleListText = visibleRoles
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

            const maxRoleWord = maxRoles === 1 ? 'role' : 'roles';

            if (parsedRoles.length > visibleLimit) {
                const remaining = parsedRoles.length - visibleLimit;
                containerComponents.push({ type: 10, content: `-# <:hawo:1490521492696465519> And **${remaining}** more...\n-# <:invisible:1509293351365640263> Max selection: **${maxRoles}** ${maxRoleWord}` });
            } else {
                containerComponents.push({ type: 10, content: `-# <:hawo:1490521492696465519> Max selection: **${maxRoles}** ${maxRoleWord}` });
            }
            containerComponents.push({ type: 14, spacing: 2, divider: true });
            containerComponents.push({
                type: 1,
                components: [selectMenu],
            });

            const components = [];

            if (addSpacers) {
                components.push({ type: 14, spacing: 2, divider: false });
                components.push({ type: 14, spacing: 2, divider: false });
            }

            if (bannerUrl) {
                components.push({
                    type: 12,
                    items: [{ media: { url: bannerUrl } }],
                });
            }

            components.push({
                type: 17,
                components: containerComponents,
            });

            try {
                await message.delete().catch(() => {});
                const sentMsg = await client.rest.post(Routes.channelMessages(message.channel.id), {
                    body: { flags: 1 << 15, allowed_mentions: { parse: [], roles: [] }, components },
                });

                // Save CRM menu to DB
                await db.saveCRMMenu({
                    customId: selectCustomId,
                    guildId: message.guild.id,
                    channelId: message.channel.id,
                    messageId: sentMsg.id,
                    roleIds: parsedRoles.map(r => r.roleId),
                    specs,
                });
            } catch (e) {
                console.error('[crm] Failed to send role menu:', e.message);
                await message.channel.send({ content: `❌ Failed to create role menu: ${e.message}` }).catch(() => {});
            }

            return;
        }

        // ── Revive / RandomQ (hardcoded c! prefix) ──────────────────────────
        const reviveMatch = content.match(/^c!(revive|randomq)\b/i);
        if (reviveMatch) {
            const isRandom = reviveMatch[1].toLowerCase() === 'randomq';
            const typeKey = isRandom ? 'randomquestion' : 'chat';
            const settings = await db.getServerSettings(guildId);
            const roleKey = `reviveRole_${typeKey}`;
            const roleId = settings[roleKey];

            if (!roleId) {
                await message.reply({ content: '<:writing:1526779827611500604> No revive role has been set for **' + typeKey + '**. An admin can use `/setreviverole` to set it.' }).catch(() => {});
                return;
            }

            const cooldown = await db.getReviveCooldown(guildId, typeKey);
            if (cooldown && Date.now() < cooldown) {
                await message.reply({ content: '<:writing:1526779827611500604> This can be done again <t:' + Math.floor(cooldown / 1000) + ':R>.' }).catch(() => {});
                return;
            }

            await db.setReviveCooldown(guildId, typeKey, Date.now() + 7200000);

            // ── Check requirement role ──────────────────────────────────────
            const reqRoleId = settings[`reviveReqRole_${typeKey}`];
            if (reqRoleId) {
                const reqRole = message.guild.roles.cache.get(reqRoleId);
                if (reqRole && message.member.roles.highest.position < reqRole.position && message.guild.ownerId !== message.author.id) {
                    await message.reply({ content: '<:writing:1526779827611500604> You need ' + reqRole.toString() + ' or higher to use this command.' }).catch(() => {});
                    return;
                }
            }

            const customText = content.slice(reviveMatch[0].length).trim();

            let bodyContent;
            if (isRandom) {
                if (customText) {
                    bodyContent = '<:writing:1526779827611500604> <@&' + roleId + '>, ' + customText + '?';
                } else {
                    const questions = require('../data/revivequestions.json');
                    const question = questions[Math.floor(Math.random() * questions.length)];
                    bodyContent = '<:writing:1526779827611500604> <@&' + roleId + '>, answer me this~!\n<:garrow:1530759025753456681> ' + question + '?';
                }
            } else {
                bodyContent = '<:writing:1526779827611500604> <@&' + roleId + '>, ' + (customText || 'wake up~!');
            }

            const payload = {
                flags: 32768,
                allowed_mentions: { parse: ['roles'] },
                components: [
                    { type: 10, content: bodyContent },
                    {
                        type: 1,
                        components: [
                            { type: 2, style: 2, label: 'Get Role', custom_id: 'btn_1785115813345_9lcn', emoji: { id: '1524864466422861924', name: 'whitestar', animated: false } },
                            { type: 2, style: 2, label: 'Remove Role', custom_id: 'btn_1785115814564_k5vj', emoji: { id: '1524864466422861924', name: 'whitestar', animated: false } },
                        ],
                    },
                ],
            };

            try {
                if (customText) {
                    await message.delete().catch(() => {});
                }
                const sent = await client.rest.post(Routes.channelMessages(message.channel.id), { body: payload });
                await db.saveReviveMessage(sent.id, guildId, roleId, typeKey);
            } catch (e) {
                console.error('[revive] Failed:', e.message);
                await message.channel.send({ content: '❌ Failed: ' + e.message }).catch(() => {});
            }
            return;
        }

        // ── c!reset — reset both revive cooldowns ─────────────────────────────
        if (/^c!reset\b/i.test(content)) {
            if (!message.member.permissions.has('ManageGuild')) {
                await message.reply({ content: '❌ You need Manage Server permission.' }).catch(() => {});
                return;
            }
            await db.getCollection('revivecooldowns').deleteOne({ key: guildId + ':chat' });
            await db.getCollection('revivecooldowns').deleteOne({ key: guildId + ':randomquestion' });
            await message.reply({ content: '<:writing:1526779827611500604> Both revive cooldowns have been reset.' }).catch(() => {});
            return;
        }

        // ── Level sync (,sync / c!sync) ─────────────────────────────────────
        const syncAlias = content.match(/^(c!|,)sync(?:\s+<@!?(\d+)>)?(?:\s+(\d+))?$/i);
        if (syncAlias) {
            const lvlSettings = await db.getLevelSettings(guildId);
            if (!lvlSettings.enabled) return;
            const targetId = syncAlias[2];
            if (targetId && !message.member.permissions.has('ManageGuild')) {
                return message.reply({ content: '❌ You need Manage Server permission to sync other users.' }).catch(() => {});
            }
            try {
                const amount = syncAlias[3];
                let targetUser = null;
                if (targetId) {
                    targetUser = message.guild.members.cache.get(targetId) || await message.guild.members.fetch(targetId).catch(() => null);
                    if (!targetUser) return message.reply({ content: '❌ Could not find that user in this server.' }).catch(() => {});
                }
                const payload = await leveling.syncUser(message, client, targetUser, amount !== undefined ? Number(amount) : undefined);
                await message.reply(payload).catch(e => console.error('[levels] sync reply failed:', e.message));
            } catch (e) {
                console.error('[levels] sync error:', e.message);
            }
            return;
        }

        // ── Level aliases (c!lb ,lb / c!rank ,rank / c!level ,level) ─────────
        const levelAlias = content.match(/^(c!|,)(lb|rank|level)(?:\s+(global|server))?$/i);
        if (levelAlias) {
            const lvlSettings = await db.getLevelSettings(guildId);
            if (!lvlSettings.enabled) return;
            try {
                const cmd = levelAlias[2].toLowerCase();
                const mode = (levelAlias[3] || 'server').toLowerCase();
                if (cmd === 'lb') {
                    const payload = await leveling.buildLeaderboardPayload({ guildId, requesterId: message.author.id, type: mode, page: 1 });
                    payload.message_reference = { channel_id: message.channel.id, message_id: message.id };
                    await client.rest.post(Routes.channelMessages(message.channel.id), { body: payload }).catch(e => console.error('[levels] lb send failed:', e.message));
                } else {
                    const payload = await leveling.rankPayloadFor({ guildId, userId: message.author.id });
                    await message.reply(payload).catch(e => console.error('[levels] rank send failed:', e.message));
                }
            } catch (e) {
                console.error('[levels] alias error:', e.message);
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
