const { SlashCommandBuilder } = require('discord.js');
const db = require('../database/db');
const leveling = require('../utils/leveling');

const RSTARS = '<:rstars:1536181894469918830>';
const ADMIN_SUBS = ['config', 'setreward', 'reset', 'xp', 'lvl'];

function confirm(text) {
    return leveling.confirmPayload(`${RSTARS} ${text}`);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('level')
        .setDescription('Leveling system commands')
        .addSubcommand(s => s.setName('config').setDescription('Configure the leveling system')
            .addBooleanOption(o => o.setName('enabled').setDescription('Enable/disable leveling (default: off)'))
            .addChannelOption(o => o.setName('levelup_channel').setDescription('Channel used for level-up messages'))
            .addBooleanOption(o => o.setName('disable_levelmsgs').setDescription('Completely disable level-up messages'))
            .addIntegerOption(o => o.setName('xp').setDescription('XP gained per message (default: 10)').setMinValue(1).setMaxValue(100000)))
        .addSubcommand(s => s.setName('setreward').setDescription('Set a role/perk reward for a level')
            .addIntegerOption(o => o.setName('level').setDescription('The level this reward unlocks at').setRequired(true).setMinValue(0).setMaxValue(500))
            .addBooleanOption(o => o.setName('enabled').setDescription('Enable/disable this reward (enabled by default)'))
            .addRoleOption(o => o.setName('role_given').setDescription('Role given when someone reaches this level'))
            .addStringOption(o => o.setName('perk_message').setDescription('Perk text shown on rank/level-up cards')))
        .addSubcommand(s => s.setName('reset').setDescription('Reset a user\'s level and XP')
            .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true)))
        .addSubcommand(s => s.setName('xp').setDescription('Add/set/remove/reset a user\'s XP')
            .addStringOption(o => o.setName('action').setDescription('What to do').setRequired(true).addChoices(
                { name: 'add', value: 'add' },
                { name: 'set', value: 'set' },
                { name: 'remove', value: 'remove' },
                { name: 'reset', value: 'reset' }))
            .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
            .addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(0)))
        .addSubcommand(s => s.setName('lvl').setDescription('Add/set/remove/reset a user\'s level')
            .addStringOption(o => o.setName('action').setDescription('What to do').setRequired(true).addChoices(
                { name: 'add', value: 'add' },
                { name: 'set', value: 'set' },
                { name: 'remove', value: 'remove' },
                { name: 'reset', value: 'reset' }))
            .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
            .addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(0)))
        .addSubcommand(s => s.setName('rank').setDescription('View your or someone\'s rank card')
            .addUserOption(o => o.setName('user').setDescription('User to check')))
        .addSubcommand(s => s.setName('leaderboard').setDescription('View the XP leaderboard')
            .addStringOption(o => o.setName('type').setDescription('Leaderboard type (default: server)').addChoices(
                { name: 'server', value: 'server' },
                { name: 'global', value: 'global' }))),

    async execute(interaction, client) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guildId;

        // rank + leaderboard are public; everything else needs ManageGuild
        // (trusted users get ALMIGHTY_PERMS injected by interactionCreate).
        if (ADMIN_SUBS.includes(sub)) {
            const memberPerms = interaction.member?.permissions;
            if (!memberPerms?.has('ManageGuild')) {
                return interaction.reply({ content: '❌ You do not have permission to use this command.', flags: 64 });
            }
        }

        // ── /level config ────────────────────────────────────────────────────
        if (sub === 'config') {
            const enabled = interaction.options.getBoolean('enabled');
            const channel = interaction.options.getChannel('levelup_channel');
            const disableLevelMsgs = interaction.options.getBoolean('disable_levelmsgs');
            const xp = interaction.options.getInteger('xp');

            const update = {};
            if (enabled !== null) update.enabled = enabled;
            if (channel) update.levelUpChannel = channel.id;
            if (disableLevelMsgs !== null) update.disableLevelMsgs = disableLevelMsgs;
            if (xp !== null) update.xpPerMessage = xp;

            if (!Object.keys(update).length) {
                const cur = await db.getLevelSettings(guildId);
                const lines = [
                    `**Enabled**: ${cur.enabled ? '✅ Yes' : '❌ No (default: off)'}`,
                    `**Level-up channel**: ${cur.levelUpChannel ? `<#${cur.levelUpChannel}>` : '*(none)*'}`,
                    `**Level-up messages**: ${cur.disableLevelMsgs ? '🔕 Disabled' : '✅ Enabled'}`,
                    `**XP per message**: ${cur.xpPerMessage || 10}`,
                ];
                return interaction.reply(confirm(`Current level settings:\n${lines.join('\n')}`));
            }

            await db.setLevelSettings(guildId, update);

            const parts = [];
            if (enabled === true) parts.push('Successfully __enabled__ leveling system~!');
            if (enabled === false) parts.push('Successfully __disabled__ leveling system~!');
            if (channel) parts.push(`Successfully __set__ level-up channel to ${channel}~!`);
            if (disableLevelMsgs === true) parts.push('Successfully __disabled__ level-up __messages__~!');
            if (disableLevelMsgs === false) parts.push('Successfully __enabled__ level-up __messages__~!');
            if (xp !== null) parts.push(`Successfully __set__ XP per message to **${xp}**~!`);

            if (enabled === true) {
                const cur = await db.getLevelSettings(guildId);
                if (!cur.levelUpChannel && !channel) {
                    parts.push("Don't forget to set a level-up channel with `/level config levelup_channel:#channel`~!");
                }
            }

            return interaction.reply(confirm(parts.join('\n')));
        }

        // ── /level setreward ─────────────────────────────────────────────────
        if (sub === 'setreward') {
            const lv = interaction.options.getInteger('level');
            const enabled = interaction.options.getBoolean('enabled');
            const roleGiven = interaction.options.getRole('role_given');
            const perkMessage = interaction.options.getString('perk_message');

            const rewards = await db.getLevelRewards(guildId);
            const existing = rewards[lv] || { level: lv, enabled: true, roleGiven: null, perkMessage: null };

            // No options given → show current reward info.
            if (enabled === null && !roleGiven && perkMessage === null) {
                if (existing.enabled === false) {
                    return interaction.reply(confirm(`The level **${lv}** reward is __disabled__. Use \`/level setreward ${lv} enabled:true\` to re-enable it.`));
                }
                return interaction.reply(confirm(`**Level ${lv}** reward:\n• **Role**: ${existing.roleGiven ? `<@&${existing.roleGiven}>` : '*(none)*'}\n• **Perk message**: ${existing.perkMessage || '*(none)*'}\nUse \`/level setreward ${lv} role_given:@role perk_message:...\` to set it.`));
            }

            const updated = { ...existing };
            if (enabled === true) updated.enabled = true;
            else if (enabled === false) updated.enabled = false;
            if (roleGiven) updated.roleGiven = roleGiven.id;
            if (perkMessage !== null) updated.perkMessage = perkMessage;

            await db.setLevelReward(guildId, lv, updated);

            const parts = [];
            if (enabled === true) parts.push(`__enabled__ the level **${lv}** reward`);
            if (enabled === false) parts.push(`__disabled__ the level **${lv}** reward`);
            if (roleGiven) parts.push(`__set__ ${roleGiven} as the role for level **${lv}**`);
            if (perkMessage !== null) parts.push(`__set__ the perk message for level **${lv}**`);
            if (!parts.length) parts.push(`__updated__ the level **${lv}** reward`);
            return interaction.reply(confirm(`Successfully ${parts.join(' & ')}~!`));
        }

        // ── /level reset ─────────────────────────────────────────────────────
        if (sub === 'reset') {
            const target = interaction.options.getUser('user');
            await db.getCollection('levels').deleteOne({ guildId, userId: target.id });
            return interaction.reply(confirm(`Successfully __reset__ the **level & XP** of ${target}~!`));
        }

        // ── /level xp ────────────────────────────────────────────────────────
        if (sub === 'xp') {
            const action = interaction.options.getString('action');
            const target = interaction.options.getUser('user');
            const amount = interaction.options.getInteger('amount') || 0;

            const data = await db.getLevelUser(guildId, target.id);
            let { level = 0, xp = 0, messages = 0, lastXP = 0, synced = false } = data;

            if (action === 'add') xp = xp + amount;
            else if (action === 'set') xp = amount;
            else if (action === 'remove') xp = xp - amount;
            else if (action === 'reset') xp = 0;

            const prevLevel = level;
            // Normalize: level up when xp exceeds the threshold, level down when
            // it goes negative.
            while (xp >= db.xpForLevel(level)) {
                xp -= db.xpForLevel(level);
                level += 1;
            }
            while (xp < 0 && level > 0) {
                level -= 1;
                xp += db.xpForLevel(level);
            }
            if (xp < 0) xp = 0;

            await db.setLevelUser(guildId, target.id, { level, xp, messages, lastXP, synced });

            if (level !== prevLevel) {
                await leveling.postLevelChange({ client, guild: interaction.guild, userId: target.id, prevLevel, newLevel: level, xp });
            }

            const text = action === 'reset'
                ? `Successfully __reset__ the **XP** of ${target}~!`
                : `Successfully __${action}__ **${amount.toLocaleString()} XP** ${action === 'set' ? 'to' : ''} ${target}~!`;
            return interaction.reply(confirm(text.trim().replace(/\s+/g, ' ')));
        }

        // ── /level lvl ───────────────────────────────────────────────────────
        if (sub === 'lvl') {
            const action = interaction.options.getString('action');
            const target = interaction.options.getUser('user');
            const amount = interaction.options.getInteger('amount') || 0;

            const data = await db.getLevelUser(guildId, target.id);
            let { level = 0, xp = 0, messages = 0, lastXP = 0, synced = false } = data;

            const prevLevel = level;
            // Note: resetting the level does NOT reset XP.
            if (action === 'add') level = level + amount;
            else if (action === 'set') level = amount;
            else if (action === 'remove') level = Math.max(0, level - amount);
            else if (action === 'reset') level = 0;

            await db.setLevelUser(guildId, target.id, { level, xp, messages, lastXP, synced });

            if (level !== prevLevel) {
                await leveling.postLevelChange({ client, guild: interaction.guild, userId: target.id, prevLevel, newLevel: level, xp });
            }

            const text = action === 'reset'
                ? `Successfully __reset__ the **level** of ${target}~! *(XP kept)*`
                : `Successfully __${action}__ **${amount.toLocaleString()} levels** ${action === 'set' ? 'to' : ''} ${target}~!`;
            return interaction.reply(confirm(text.trim().replace(/\s+/g, ' ')));
        }

        // ── /level rank ──────────────────────────────────────────────────────
        if (sub === 'rank') {
            const target = interaction.options.getUser('user') || interaction.user;
            const payload = await leveling.rankPayloadFor({ guildId, userId: target.id });
            return interaction.reply(payload);
        }

        // ── /level leaderboard ───────────────────────────────────────────────
        if (sub === 'leaderboard') {
            const type = interaction.options.getString('type') || 'server';
            const payload = await leveling.buildLeaderboardPayload({ guildId, requesterId: interaction.user.id, type, page: 1 });
            return interaction.reply(payload);
        }
    },
};