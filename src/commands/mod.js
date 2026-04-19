const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../database/db');
const { botEmbed } = require('../utils/parser');

function parseDuration(str) {
    const match = str.match(/^(\d+)([smhd])$/i);
    if (!match) return null;
    const [, n, unit] = match;
    const map = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    return parseInt(n) * map[unit.toLowerCase()];
}

function fmtDuration(ms) {
    const d = Math.floor(ms / 86400000); ms %= 86400000;
    const h = Math.floor(ms / 3600000);  ms %= 3600000;
    const m = Math.floor(ms / 60000);    ms %= 60000;
    const s = Math.floor(ms / 1000);
    return [d && `${d}d`, h && `${h}h`, m && `${m}m`, s && `${s}s`].filter(Boolean).join(' ') || '0s';
}

module.exports = {
    permissions: ['ModerateMembers'], // used by interactionCreate.js for trust gating

    data: new SlashCommandBuilder()
        .setName('mod')
        .setDescription('Moderation commands')
        .addSubcommand(s => s.setName('ban').setDescription('Ban a member')
            .addUserOption(o => o.setName('user').setDescription('User to ban').setRequired(true))
            .addStringOption(o => o.setName('reason').setDescription('Reason'))
            .addIntegerOption(o => o.setName('delete_days').setDescription('Delete message history (days)').setMinValue(0).setMaxValue(7)))
        .addSubcommand(s => s.setName('unban').setDescription('Unban a user by ID')
            .addStringOption(o => o.setName('user_id').setDescription('User ID').setRequired(true))
            .addStringOption(o => o.setName('reason').setDescription('Reason')))
        .addSubcommand(s => s.setName('kick').setDescription('Kick a member')
            .addUserOption(o => o.setName('user').setDescription('User to kick').setRequired(true))
            .addStringOption(o => o.setName('reason').setDescription('Reason')))
        .addSubcommand(s => s.setName('timeout').setDescription('Timeout (mute) a member')
            .addUserOption(o => o.setName('user').setDescription('User to timeout').setRequired(true))
            .addStringOption(o => o.setName('duration').setDescription('Duration e.g. 10m, 2h, 1d').setRequired(true))
            .addStringOption(o => o.setName('reason').setDescription('Reason')))
        .addSubcommand(s => s.setName('untimeout').setDescription('Remove a timeout from a member')
            .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
            .addStringOption(o => o.setName('reason').setDescription('Reason')))
        .addSubcommand(s => s.setName('warn').setDescription('Warn a member')
            .addUserOption(o => o.setName('user').setDescription('User to warn').setRequired(true))
            .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(true)))
        .addSubcommand(s => s.setName('warnings').setDescription('View a member\'s warnings')
            .addUserOption(o => o.setName('user').setDescription('User').setRequired(true)))
        .addSubcommand(s => s.setName('delwarn').setDescription('Delete a warning by ID')
            .addIntegerOption(o => o.setName('id').setDescription('Warning ID').setRequired(true)))
        .addSubcommand(s => s.setName('purge').setDescription('Bulk delete messages')
            .addIntegerOption(o => o.setName('amount').setDescription('Number of messages (1-100)').setRequired(true).setMinValue(1).setMaxValue(100))
            .addUserOption(o => o.setName('user').setDescription('Only delete messages from this user')))
        .addSubcommand(s => s.setName('slowmode').setDescription('Set channel slowmode')
            .addStringOption(o => o.setName('duration').setDescription('Duration e.g. 5s, 1m, 0 to disable').setRequired(true))
            .addChannelOption(o => o.setName('channel').setDescription('Channel (defaults to current)')))
        .addSubcommand(s => s.setName('lock').setDescription('Lock a channel (prevent messages)')
            .addChannelOption(o => o.setName('channel').setDescription('Channel (defaults to current)'))
            .addStringOption(o => o.setName('reason').setDescription('Reason')))
        .addSubcommand(s => s.setName('unlock').setDescription('Unlock a channel')
            .addChannelOption(o => o.setName('channel').setDescription('Channel (defaults to current)'))
            .addStringOption(o => o.setName('reason').setDescription('Reason')))
        .addSubcommand(s => s.setName('nickname').setDescription('Change a member\'s nickname')
            .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
            .addStringOption(o => o.setName('nickname').setDescription('New nickname (leave empty to reset)')))
        .addSubcommand(s => s.setName('modlogs').setDescription('View moderation history for a user')
            .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))),

    async execute(interaction, client) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guildId;
        const mod = interaction.member;

        const logAction = (type, userId, reason) => {
            db.addModLog(guildId, { type, userId, moderatorId: interaction.user.id, reason });
        };

        // Helper: check a specific permission and reply if missing.
        // Because interactionCreate.js injects ALMIGHTY_PERMS for trusted users,
        // mod.permissions.has() will always return true for them — no special
        // casing needed here at all.
        const requirePerm = (perm) => {
            if (!mod.permissions.has(perm)) {
                interaction.reply({ content: `❌ You need the **${perm}** permission.`, ephemeral: true });
                return false;
            }
            return true;
        };

        // ── Ban ──────────────────────────────────────────────────────────────
        if (sub === 'ban') {
            if (!requirePerm('BanMembers')) return;
            const target = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') || 'No reason provided';
            const delDays = interaction.options.getInteger('delete_days') ?? 0;
            const member = await interaction.guild.members.fetch(target.id).catch(() => null);
            if (member && !member.bannable) return interaction.reply({ content: '❌ I cannot ban this member.', ephemeral: true });
            try {
                await target.send({ embeds: [botEmbed('#ff6b6b').setTitle(`You were banned from **${interaction.guild.name}**`).setDescription(`**Reason:** ${reason}`)] }).catch(() => {});
                await interaction.guild.members.ban(target, { reason, deleteMessageDays: delDays });
                logAction('ban', target.id, reason);
                return interaction.reply({ embeds: [botEmbed('#ff6b6b').setTitle('🔨 Member Banned').addFields({ name: 'User', value: `${target} (${target.id})`, inline: true }, { name: 'Reason', value: reason })] });
            } catch (e) {
                return interaction.reply({ content: `❌ Failed to ban: ${e.message}`, ephemeral: true });
            }
        }

        // ── Unban ────────────────────────────────────────────────────────────
        if (sub === 'unban') {
            if (!requirePerm('BanMembers')) return;
            const userId = interaction.options.getString('user_id');
            const reason = interaction.options.getString('reason') || 'No reason provided';
            try {
                await interaction.guild.members.unban(userId, reason);
                logAction('unban', userId, reason);
                return interaction.reply({ embeds: [botEmbed('#77dd77').setDescription(`✅ Unbanned user ID \`${userId}\`.`)] });
            } catch {
                return interaction.reply({ content: '❌ Could not unban that user. Are they actually banned?', ephemeral: true });
            }
        }

        // ── Kick ─────────────────────────────────────────────────────────────
        if (sub === 'kick') {
            if (!requirePerm('KickMembers')) return;
            const target = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') || 'No reason provided';
            const member = await interaction.guild.members.fetch(target.id).catch(() => null);
            if (!member) return interaction.reply({ content: '❌ That user is not in this server.', ephemeral: true });
            if (!member.kickable) return interaction.reply({ content: '❌ I cannot kick this member.', ephemeral: true });
            try {
                await target.send({ embeds: [botEmbed('#ffa07a').setTitle(`You were kicked from **${interaction.guild.name}**`).setDescription(`**Reason:** ${reason}`)] }).catch(() => {});
                await member.kick(reason);
                logAction('kick', target.id, reason);
                return interaction.reply({ embeds: [botEmbed('#ffa07a').setTitle('👢 Member Kicked').addFields({ name: 'User', value: `${target}`, inline: true }, { name: 'Reason', value: reason })] });
            } catch (e) {
                return interaction.reply({ content: `❌ Failed to kick: ${e.message}`, ephemeral: true });
            }
        }

        // ── Timeout ───────────────────────────────────────────────────────────
        if (sub === 'timeout') {
            if (!requirePerm('ModerateMembers')) return;
            const target = interaction.options.getUser('user');
            const durStr = interaction.options.getString('duration');
            const reason = interaction.options.getString('reason') || 'No reason provided';
            const durMs = parseDuration(durStr);
            if (!durMs || durMs > 2419200000) return interaction.reply({ content: '❌ Invalid duration. Use e.g. `10m`, `2h`, `1d`. Max 28 days.', ephemeral: true });
            const member = await interaction.guild.members.fetch(target.id).catch(() => null);
            if (!member) return interaction.reply({ content: '❌ User not in server.', ephemeral: true });
            if (!member.moderatable) return interaction.reply({ content: '❌ I cannot moderate this member.', ephemeral: true });
            await member.timeout(durMs, reason);
            logAction('timeout', target.id, `${durStr} — ${reason}`);
            return interaction.reply({ embeds: [botEmbed('#ffcc00').setTitle('⏱️ Member Timed Out').addFields({ name: 'User', value: `${target}`, inline: true }, { name: 'Duration', value: fmtDuration(durMs), inline: true }, { name: 'Reason', value: reason })] });
        }

        // ── Untimeout ─────────────────────────────────────────────────────────
        if (sub === 'untimeout') {
            if (!requirePerm('ModerateMembers')) return;
            const target = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') || 'No reason provided';
            const member = await interaction.guild.members.fetch(target.id).catch(() => null);
            if (!member) return interaction.reply({ content: '❌ User not in server.', ephemeral: true });
            await member.timeout(null, reason);
            return interaction.reply({ embeds: [botEmbed('#77dd77').setDescription(`✅ Removed timeout from ${target}.`)] });
        }

        // ── Warn ──────────────────────────────────────────────────────────────
        if (sub === 'warn') {
            if (!requirePerm('ModerateMembers')) return;
            const target = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason');
            logAction('warn', target.id, reason);
            try { await target.send({ embeds: [botEmbed('#ffd700').setTitle(`⚠️ Warning in **${interaction.guild.name}**`).setDescription(`**Reason:** ${reason}`)] }); } catch {}
            const logs = db.getUserModLogs(guildId, target.id).filter(l => l.type === 'warn');
            return interaction.reply({ embeds: [botEmbed('#ffd700').setTitle('⚠️ Member Warned').addFields({ name: 'User', value: `${target}`, inline: true }, { name: 'Total Warnings', value: String(logs.length), inline: true }, { name: 'Reason', value: reason })] });
        }

        // ── Warnings ──────────────────────────────────────────────────────────
        if (sub === 'warnings') {
            const target = interaction.options.getUser('user');
            const logs = db.getUserModLogs(guildId, target.id);
            if (!logs.length) return interaction.reply({ content: `✅ ${target.username} has no moderation history.`, ephemeral: true });
            const lines = logs.slice(-10).reverse().map(l => {
                const date = new Date(l.timestamp).toLocaleDateString('en-US');
                return `\`#${l.id}\` **${l.type}** — ${l.reason} *(${date})*`;
            });
            return interaction.reply({
                embeds: [botEmbed('#ffd700').setTitle(`📋 Mod Logs: ${target.username}`).setDescription(lines.join('\n')).setFooter({ text: `${logs.length} total entries • Showing last 10` })],
                ephemeral: true,
            });
        }

        // ── Delwarn ───────────────────────────────────────────────────────────
        if (sub === 'delwarn') {
            if (!requirePerm('ModerateMembers')) return;
            const id = interaction.options.getInteger('id');
            const raw = db.loadDB('modlogs');
            if (!raw[guildId]) return interaction.reply({ content: '❌ No modlogs for this guild.', ephemeral: true });
            const idx = raw[guildId].findIndex(l => l.id === id);
            if (idx === -1) return interaction.reply({ content: `❌ No log entry with ID \`${id}\`.`, ephemeral: true });
            raw[guildId].splice(idx, 1);
            db.saveDB('modlogs', raw);
            return interaction.reply({ content: `✅ Deleted log entry \`#${id}\`.`, ephemeral: true });
        }

        // ── Purge ─────────────────────────────────────────────────────────────
        if (sub === 'purge') {
            if (!requirePerm('ManageMessages')) return;
            const amount = interaction.options.getInteger('amount');
            const target = interaction.options.getUser('user');
            await interaction.deferReply({ ephemeral: true });
            let messages = await interaction.channel.messages.fetch({ limit: 100 });
            if (target) messages = messages.filter(m => m.author.id === target.id);
            const toDelete = [...messages.values()].slice(0, amount).filter(m => Date.now() - m.createdTimestamp < 1_209_600_000);
            if (!toDelete.length) return interaction.editReply({ content: '❌ No messages to delete (may be older than 14 days).' });
            const deleted = await interaction.channel.bulkDelete(toDelete, true).catch(e => ({ size: 0, error: e.message }));
            return interaction.editReply({ content: `🗑️ Deleted **${deleted.size ?? 0}** messages.` });
        }

        // ── Slowmode ──────────────────────────────────────────────────────────
        if (sub === 'slowmode') {
            if (!requirePerm('ManageChannels')) return;
            const durStr = interaction.options.getString('duration');
            const channel = interaction.options.getChannel('channel') || interaction.channel;
            const secs = durStr === '0' ? 0 : Math.floor((parseDuration(durStr) || 0) / 1000);
            if (secs > 21600) return interaction.reply({ content: '❌ Max slowmode is 6 hours.', ephemeral: true });
            await channel.setRateLimitPerUser(secs);
            return interaction.reply({ content: secs === 0 ? `✅ Slowmode disabled in ${channel}.` : `✅ Set slowmode to **${fmtDuration(secs * 1000)}** in ${channel}.`, ephemeral: true });
        }

        // ── Lock ─────────────────────────────────────────────────────────────
        if (sub === 'lock') {
            if (!requirePerm('ManageChannels')) return;
            const channel = interaction.options.getChannel('channel') || interaction.channel;
            const reason = interaction.options.getString('reason') || 'Channel locked';
            await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false }, { reason });
            return interaction.reply({ embeds: [botEmbed('#ff6b6b').setDescription(`🔒 ${channel} has been **locked**. ${reason}`)] });
        }

        // ── Unlock ────────────────────────────────────────────────────────────
        if (sub === 'unlock') {
            if (!requirePerm('ManageChannels')) return;
            const channel = interaction.options.getChannel('channel') || interaction.channel;
            const reason = interaction.options.getString('reason') || 'Channel unlocked';
            await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: null }, { reason });
            return interaction.reply({ embeds: [botEmbed('#77dd77').setDescription(`🔓 ${channel} has been **unlocked**.`)] });
        }

        // ── Nickname ──────────────────────────────────────────────────────────
        if (sub === 'nickname') {
            if (!requirePerm('ManageNicknames')) return;
            const target = interaction.options.getUser('user');
            const nickname = interaction.options.getString('nickname') || null;
            const member = await interaction.guild.members.fetch(target.id).catch(() => null);
            if (!member) return interaction.reply({ content: '❌ User not found in server.', ephemeral: true });
            await member.setNickname(nickname);
            return interaction.reply({ content: nickname ? `✅ Set ${target.username}'s nickname to **${nickname}**.` : `✅ Reset ${target.username}'s nickname.`, ephemeral: true });
        }

        // ── Modlogs ───────────────────────────────────────────────────────────
        if (sub === 'modlogs') {
            const target = interaction.options.getUser('user');
            const logs = db.getUserModLogs(guildId, target.id);
            if (!logs.length) return interaction.reply({ content: `✅ ${target.username} has a clean record.`, ephemeral: true });
            const lines = logs.slice(-15).reverse().map(l => {
                const date = new Date(l.timestamp).toLocaleDateString('en-US');
                const mod = `<@${l.moderatorId}>`;
                return `\`#${l.id}\` **${l.type}** by ${mod} — ${l.reason || 'N/A'} *(${date})*`;
            });
            return interaction.reply({
                embeds: [botEmbed().setTitle(`📋 Mod Logs: ${target.username}`).setDescription(lines.join('\n')).setFooter({ text: `${logs.length} total entries` })],
                ephemeral: true,
            });
        }
    },
};
