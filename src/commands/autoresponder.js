const { SlashCommandBuilder } = require('discord.js');
const db = require('../database/db');
const { botEmbed } = require('../utils/parser');

module.exports = {
    permissions: ['ManageGuild'],

    data: new SlashCommandBuilder()
        .setName('ar')
        .setDescription('Autoresponder management')
        .addSubcommand(s => s.setName('add').setDescription('Add an autoresponder')
            .addStringOption(o => o.setName('trigger').setDescription('Trigger text').setRequired(true))
            .addStringOption(o => o.setName('reply').setDescription('Reply (supports placeholders)').setRequired(true))
            .addStringOption(o => o.setName('match').setDescription('Match type').addChoices(
                { name: 'exact',      value: 'exact'      },
                { name: 'contains',   value: 'contains'   },
                { name: 'startswith', value: 'startsWith' },
                { name: 'endswith',   value: 'endsWith'   },
                { name: 'regex',      value: 'regex'      },
            ))
            .addStringOption(o => o.setName('send_type').setDescription('Reply or send').addChoices(
                { name: 'reply', value: 'reply' },
                { name: 'send',  value: 'send'  },
            ))
            .addIntegerOption(o => o.setName('cooldown').setDescription('Cooldown (seconds)').setMinValue(0))
            .addChannelOption(o => o.setName('channel').setDescription('Restrict to a specific channel (optional)')))
        .addSubcommand(s => s.setName('remove').setDescription('Remove an autoresponder')
            .addStringOption(o => o.setName('trigger').setDescription('Trigger').setRequired(true).setAutocomplete(true)))
        .addSubcommand(s => s.setName('list').setDescription('List all autoresponders'))
        .addSubcommand(s => s.setName('info').setDescription('View autoresponder details')
            .addStringOption(o => o.setName('trigger').setDescription('Trigger').setRequired(true).setAutocomplete(true))),

    async autocomplete(interaction) {
        const guildId = interaction.guildId;
        if (!guildId) return;
        const focused = interaction.options.getFocused(true);
        const ars = db.getAutoresponders(guildId);
        const choices = Object.keys(ars)
            .filter(c => c.toLowerCase().includes(focused.value.toLowerCase()))
            .slice(0, 25);
        await interaction.respond(choices.map(c => ({ name: c, value: c }))).catch(() => {});
    },

    async execute(interaction, client) {
        const sub     = interaction.options.getSubcommand();
        const guildId = interaction.guildId;

        if (sub === 'add') {
            const trigger   = interaction.options.getString('trigger');
            const reply     = interaction.options.getString('reply');
            const matchType = interaction.options.getString('match')     || 'exact';
            const sendType  = interaction.options.getString('send_type') || 'reply';
            const cooldown  = interaction.options.getInteger('cooldown') ?? 0;
            const channel   = interaction.options.getChannel('channel');

            if (matchType === 'regex') {
                try { new RegExp(trigger); } catch {
                    return interaction.reply({ content: '❌ Invalid regex pattern.', ephemeral: true });
                }
            }

            const existing = db.getAutoresponders(guildId);
            if (Object.keys(existing).length >= 100) {
                return interaction.reply({ content: '❌ You have reached the limit of 100 autoresponders.', ephemeral: true });
            }

            db.saveAutoresponder(guildId, trigger, {
                reply,
                matchType,
                sendType,
                cooldown:  cooldown || null,
                channelId: channel?.id || null,
            });

            return interaction.reply({
                embeds: [botEmbed('#77dd77').setTitle('✅ Autoresponder Added')
                    .addFields(
                        { name: 'Trigger',  value: `\`${trigger}\``,                        inline: true },
                        { name: 'Match',    value: matchType,                                inline: true },
                        { name: 'Type',     value: sendType,                                 inline: true },
                        { name: 'Cooldown', value: cooldown ? `${cooldown}s` : 'None',       inline: true },
                        { name: 'Channel',  value: channel ? `<#${channel.id}>` : 'Any',     inline: true },
                        { name: 'Reply',    value: reply.length > 1024 ? reply.slice(0, 1021) + '...' : reply },
                    )],
                ephemeral: true,
            });
        }

        if (sub === 'remove') {
            const trigger = interaction.options.getString('trigger');
            const all = db.getAutoresponders(guildId);
            if (!all[trigger]) return interaction.reply({ content: `❌ No autoresponder with trigger \`${trigger}\`.`, ephemeral: true });
            db.deleteAutoresponder(guildId, trigger);
            return interaction.reply({ content: `✅ Autoresponder \`${trigger}\` removed.`, ephemeral: true });
        }

        if (sub === 'list') {
            const all  = db.getAutoresponders(guildId);
            const keys = Object.keys(all);
            if (!keys.length) return interaction.reply({ content: '📭 No autoresponders yet. Add one with `/ar add`.', ephemeral: true });

            const chunks = [];
            let current = '';
            for (const k of keys) {
                const line = `• \`${k}\` (${all[k].matchType})\n`;
                if (current.length + line.length > 4000) { chunks.push(current); current = ''; }
                current += line;
            }
            if (current) chunks.push(current);

            return interaction.reply({
                embeds: [botEmbed().setTitle(`📋 Autoresponders (${keys.length})`).setDescription(chunks[0])],
                ephemeral: true,
            });
        }

        if (sub === 'info') {
            const trigger = interaction.options.getString('trigger');
            const all  = db.getAutoresponders(guildId);
            const data = all[trigger];
            if (!data) return interaction.reply({ content: `❌ No autoresponder with trigger \`${trigger}\`.`, ephemeral: true });

            return interaction.reply({
                embeds: [botEmbed().setTitle(`🔍 Autoresponder: \`${trigger}\``)
                    .addFields(
                        { name: 'Match Type', value: data.matchType || 'exact',                               inline: true },
                        { name: 'Send Type',  value: data.sendType  || 'reply',                               inline: true },
                        { name: 'Cooldown',   value: data.cooldown ? `${data.cooldown}s` : 'None',            inline: true },
                        { name: 'Channel',    value: data.channelId ? `<#${data.channelId}>` : 'Any',         inline: true },
                        { name: 'Reply',      value: (data.reply || '').slice(0, 1024) || 'None' },
                    )],
                ephemeral: true,
            });
        }
    },
};
