const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database/db');
const { parseDuration } = require('../utils/duration');
const { buildGiveawayPayload, endGiveaway } = require('../events/giveawayHandler');

module.exports = {
    permissions: ['ManageGuild'],

    data: new SlashCommandBuilder()
        .setName('gw')
        .setDescription('Giveaway system')
        .addSubcommand(s => s.setName('create')
            .setDescription('Create a giveaway template')
            .addStringOption(o => o.setName('id').setDescription('Unique ID for the giveaway').setRequired(true).setMaxLength(50))
            .addStringOption(o => o.setName('title').setDescription('Title of the giveaway').setRequired(true).setMaxLength(100))
            .addStringOption(o => o.setName('description').setDescription('Description for the giveaway').setRequired(true).setMaxLength(1500)))
        .addSubcommand(s => s.setName('edit')
            .setDescription('Edit an existing giveaway template')
            .addStringOption(o => o.setName('id').setDescription('ID of the giveaway to edit').setRequired(true).setMaxLength(50).setAutocomplete(true))
            .addStringOption(o => o.setName('title').setDescription('New title (leave empty to keep current)').setMaxLength(100))
            .addStringOption(o => o.setName('description').setDescription('New description (leave empty to keep current)').setMaxLength(1500)))
        .addSubcommand(s => s.setName('send')
            .setDescription('Send a giveaway from a template')
            .addStringOption(o => o.setName('id').setDescription('ID of the giveaway template to send').setRequired(true).setMaxLength(50).setAutocomplete(true))
            .addStringOption(o => o.setName('duration').setDescription('Duration (e.g. 20h, 2d, 1m30s)').setRequired(true))
            .addChannelOption(o => o.setName('channel').setDescription('Channel to send in (defaults to current)'))
            .addIntegerOption(o => o.setName('winners').setDescription('Number of winners (default: 1)').setMinValue(1).setMaxValue(9))
            .addUserOption(o => o.setName('sponsor').setDescription('User sponsoring the giveaway payouts')))
        .addSubcommand(s => s.setName('delete')
            .setDescription('Delete a giveaway template')
            .addStringOption(o => o.setName('id').setDescription('ID of the giveaway to delete').setRequired(true).setMaxLength(50).setAutocomplete(true)))
        .addSubcommand(s => s.setName('list')
            .setDescription('List all giveaway templates in this server')),

    async autocomplete(interaction) {
        const focused = interaction.options.getFocused();
        if (typeof focused !== 'string') return;
        const giveaways = await db.getAllGiveaways(interaction.guildId);
        if (!giveaways || !Array.isArray(giveaways)) return;
        const lower = focused.toLowerCase();
        const choices = giveaways
            .filter(g => g && g.id && g.title && (g.id.toLowerCase().includes(lower) || g.title.toLowerCase().includes(lower)))
            .slice(0, 25)
            .map(g => ({ name: g.id.slice(0, 100), value: g.id }));
        await interaction.respond(choices);
    },

    async execute(interaction, client) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guildId;

        if (sub === 'create') {
            const id = interaction.options.getString('id');
            const title = interaction.options.getString('title');
            const description = interaction.options.getString('description');

            const existing = await db.getGiveaway(guildId, id);
            if (existing) {
                return interaction.reply({ content: `❌ A giveaway with ID "**${id}**" already exists.`, flags: 64 });
            }

            const activeForThisId = await db.getActiveGiveawaysByGuild(guildId);
            if (activeForThisId.some(a => a.id === id)) {
                return interaction.reply({ content: `❌ An **active** giveaway with ID "**${id}**" is currently running. Wait for it to end first.`, flags: 64 });
            }

            await db.saveGiveaway(guildId, id, { id, title, description });
            return interaction.reply({ content: `✅ Created giveaway template \`${id}\` — "**${title}**".\nUse \`/gw send\` to launch it.`, flags: 64 });
        }

        if (sub === 'edit') {
            const id = interaction.options.getString('id');
            const newTitle = interaction.options.getString('title');
            const newDescription = interaction.options.getString('description');

            const existing = await db.getGiveawayById(guildId, id);
            if (!existing) {
                return interaction.reply({ content: `❌ No giveaway found with ID "**${id}**".`, flags: 64 });
            }

            if (!newTitle && !newDescription) {
                return interaction.reply({ content: `❌ Provide at least a new \`title\` or \`description\` to update.`, flags: 64 });
            }

            const finalTitle = newTitle || existing.title;
            const finalDescription = newDescription !== null ? newDescription : existing.description;

            await db.saveGiveaway(guildId, id, { id, title: finalTitle, description: finalDescription });
            return interaction.reply({ content: `✅ Updated giveaway \`${id}\` — "**${finalTitle}**".`, flags: 64 });
        }

        if (sub === 'send') {
            await interaction.deferReply({ flags: 64 });

            const id = interaction.options.getString('id');
            const durationStr = interaction.options.getString('duration');
            const channel = interaction.options.getChannel('channel') || interaction.channel;
            const winners = interaction.options.getInteger('winners') || 1;
            const sponsor = interaction.options.getUser('sponsor');

            const template = await db.getGiveawayById(guildId, id);
            if (!template) {
                return interaction.editReply({ content: `❌ No giveaway found with ID "**${id}**".` });
            }

            const durationMs = parseDuration(durationStr);
            if (!durationMs) {
                return interaction.editReply({ content: `❌ Invalid duration "**${durationStr}**". Examples: \`20h\`, \`2d\`, \`1m30s\`, \`1d12h\`.` });
            }

            if (!channel || !channel.isTextBased || !channel.isTextBased()) {
                return interaction.editReply({ content: `❌ That channel is not a text channel.` });
            }

            const endAt = Date.now() + durationMs;
            const hosterId = interaction.user.id;
            const title = template.title;
            const description = template.description || '';

            const payload = buildGiveawayPayload({
                title,
                description,
                winners,
                sponsor: sponsor ? sponsor.id : null,
                hosterId,
                endAt,
                durationMs,
                entrantCount: 0,
            });

            let sentMessage;
            try {
                sentMessage = await channel.send(payload);
            } catch (e) {
                console.error('[Giveaway] Failed to send giveaway message:', e);
                return interaction.editReply({ content: `❌ Failed to send the giveaway message: ${e.message}` });
            }

            await db.saveActiveGiveaway({
                guildId,
                channelId: channel.id,
                messageId: sentMessage.id,
                id,
                title,
                description,
                winners,
                sponsor: sponsor ? sponsor.id : null,
                hosterId,
                entrants: [],
                endAt,
                ended: false,
                durationMs,
                durationRaw: durationStr,
                originalPayload: payload,
            });

            setTimeout(() => {
                const gw = {
                    guildId,
                    channelId: channel.id,
                    messageId: sentMessage.id,
                    id,
                    title,
                    description,
                    winners,
                    sponsor: sponsor ? sponsor.id : null,
                    hosterId,
                };
                endGiveaway(client, gw);
            }, durationMs);

            return interaction.editReply({ content: `✅ Giveaway \`${id}\` — "**${title}**" sent to ${channel} and will end in **${durationStr}**.` });
        }

        if (sub === 'delete') {
            const id = interaction.options.getString('id');
            const existing = await db.getGiveawayById(guildId, id);
            if (!existing) {
                return interaction.reply({ content: `❌ No giveaway found with ID "**${id}**".`, flags: 64 });
            }

            await db.deleteGiveaway(guildId, id);

            const active = await db.getActiveGiveawaysByGuild(guildId);
            for (const gw of active) {
                if (gw.id === id) {
                    try {
                        const channel = client.channels.cache.get(gw.channelId);
                        if (channel) {
                            const msg = await channel.messages.fetch(gw.messageId).catch(() => null);
                            if (msg) await msg.delete().catch(() => {});
                        }
                    } catch (e) {}
                    await db.deleteActiveGiveaway(guildId, gw.messageId);
                }
            }

            return interaction.reply({ content: `✅ Deleted giveaway \`${id}\` — "**${existing.title}**".`, flags: 64 });
        }

        if (sub === 'list') {
            await interaction.deferReply({ flags: 64 });

            const giveaways = await db.getAllGiveaways(guildId);
            if (!giveaways.length) {
                return interaction.editReply({ content: '📭 No giveaway templates found. Use `/gw create` to create one.' });
            }

            const active = await db.getActiveGiveawaysByGuild(guildId);

            const lines = [];
            for (let i = 0; i < giveaways.length; i++) {
                const g = giveaways[i];
                const activeGw = active.find(a => a.id === g.id);
                let line = `**${i + 1}.** \`${g.id}\` — **${g.title}**`;
                if (activeGw) {
                    const remaining = Math.max(0, activeGw.endAt - Date.now());
                    const remainingMin = Math.ceil(remaining / 60000);
                    line += ` *(active — ${activeGw.entrants?.length || 0} entrants, ~${remainingMin}m left)*`;
                }
                const desc = (g.description || '').replace(/\\n/g, ' ').replace(/\{newline\}/gi, ' ').replace(/%nl%/gi, ' ');
                const truncated = desc.length > 80 ? `${desc.slice(0, 80)}…` : desc;
                line += `\n  - ${truncated || '*(no description)*'}`;
                lines.push(line);
            }

            const embed = new EmbedBuilder()
                .setColor('#c9b8f5')
                .setTitle(`🎁 Giveaway Templates (${giveaways.length})`)
                .setDescription(lines.join('\n\n'));

            return interaction.editReply({ embeds: [embed] });
        }
    },
};
