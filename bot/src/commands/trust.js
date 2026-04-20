const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../database/db');
const { botEmbed } = require('../utils/parser');

const SPECIAL_USERS = ['1439442692269408306', '1486469966332170392'];

module.exports = {
    // Only admins can manage trust; trusted users get it via ALMIGHTY_PERMS in interactionCreate
    permissions: ['Administrator'],

    data: new SlashCommandBuilder()
        .setName('trust')
        .setDescription('Manage trusted users (bypass permission checks)')
        .addSubcommand(s => s.setName('add').setDescription('Grant a user trusted status')
            .addUserOption(o => o.setName('user').setDescription('User to trust').setRequired(true)))
        .addSubcommand(s => s.setName('remove').setDescription('Revoke trusted status')
            .addUserOption(o => o.setName('user').setDescription('User to untrust').setRequired(true)))
        .addSubcommand(s => s.setName('list').setDescription('List all trusted users in this server')),

    async execute(interaction, client) {
        const sub     = interaction.options.getSubcommand();
        const guildId = interaction.guildId;

        if (sub === 'add') {
            const target = interaction.options.getUser('user');

            if (SPECIAL_USERS.includes(target.id)) {
                return interaction.reply({ content: `⭐ ${target} is a permanent special user and is already trusted.`, ephemeral: true });
            }

            db.setTrusted(guildId, target.id, true);
            return interaction.reply({
                embeds: [botEmbed('#77dd77').setDescription(`✅ ${target} is now trusted and can run any bot command without needing server permissions.`)],
                ephemeral: true,
            });
        }

        if (sub === 'remove') {
            const target = interaction.options.getUser('user');

            if (SPECIAL_USERS.includes(target.id)) {
                return interaction.reply({ content: `❌ ${target} is a permanent special user and cannot be untrusted.`, ephemeral: true });
            }

            db.setTrusted(guildId, target.id, false);
            return interaction.reply({
                embeds: [botEmbed('#ff6b6b').setDescription(`✅ Removed trusted status from ${target}.`)],
                ephemeral: true,
            });
        }

        if (sub === 'list') {
            const raw = db.loadDB('trusted');
            const guildTrust = raw[guildId] || {};
            const trusted = Object.entries(guildTrust)
                .filter(([, v]) => !!v)
                .map(([userId]) => userId);

            if (!trusted.length) {
                return interaction.reply({ content: '📭 No trusted users in this server.', ephemeral: true });
            }

            const lines = trusted.map(id =>
                SPECIAL_USERS.includes(id) ? `⭐ <@${id}> *(special)*` : `• <@${id}>`
            );

            return interaction.reply({
                embeds: [botEmbed().setTitle(`🔑 Trusted Users (${trusted.length})`).setDescription(lines.join('\n'))],
                ephemeral: true,
            });
        }
    },
};
