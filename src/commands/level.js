const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const db = require('../database/db');
const { botEmbed } = require('../utils/parser');

function xpBar(xp, needed, length = 20) {
  const filled = Math.round((xp / needed) * length);
  return '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, length - filled));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('level')
    .setDescription('Leveling system commands')
    .addSubcommand(s => s.setName('rank').setDescription('View your or someone\'s rank card')
      .addUserOption(o => o.setName('user').setDescription('User to check')))
    .addSubcommand(s => s.setName('leaderboard').setDescription('View the XP leaderboard'))
    .addSubcommand(s => s.setName('config').setDescription('Configure the leveling system')
      .addBooleanOption(o => o.setName('enabled').setDescription('Enable/disable leveling'))
      .addChannelOption(o => o.setName('levelup_channel').setDescription('Channel for level-up messages (leave empty to use the message channel)'))
      .addStringOption(o => o.setName('levelup_message').setDescription('Custom level-up message. Use {user.mention} and {level}'))
      .addBooleanOption(o => o.setName('disable_levelup').setDescription('Completely disable level-up messages')))
    .addSubcommand(s => s.setName('setlevel').setDescription('[Admin] Set a user\'s level')
      .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
      .addIntegerOption(o => o.setName('level').setDescription('New level').setRequired(true).setMinValue(0).setMaxValue(500)))
    .addSubcommand(s => s.setName('setxp').setDescription('[Admin] Set a user\'s XP')
      .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
      .addIntegerOption(o => o.setName('xp').setDescription('New XP amount').setRequired(true).setMinValue(0)))
    .addSubcommand(s => s.setName('reset').setDescription('[Admin] Reset a user\'s level data')
      .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))),

  async execute(interaction, client) {
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (['config', 'setlevel', 'setxp', 'reset'].includes(sub)) {
      if (!interaction.member.permissions.has('ManageGuild') && sub === 'config') {
        return interaction.reply({ content: '❌ You need **Manage Server** permission.', ephemeral: true });
      }
      if (!interaction.member.permissions.has('Administrator') && ['setlevel', 'setxp', 'reset'].includes(sub)) {
        return interaction.reply({ content: '❌ You need **Administrator** permission.', ephemeral: true });
      }
    }

    if (sub === 'rank') {
      const target = interaction.options.getUser('user') || interaction.user;
      const data   = db.getLevelUser(guildId, target.id);
      const level  = data.level || 0;
      const xp     = data.xp    || 0;
      const needed = db.xpForLevel(level + 1);
      const currentXP = xp - Array.from({ length: level }, (_, i) => db.xpForLevel(i + 1)).reduce((a, b) => a + b, 0);

      // Get rank position
      const lb    = db.getLevelLeaderboard(guildId);
      const rank  = lb.findIndex(e => e.userId === target.id) + 1;

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#c9b8f5')
          .setAuthor({ name: target.username, iconURL: target.displayAvatarURL() })
          .setTitle('📊 Rank Card')
          .addFields(
            { name: 'Level',  value: `**${level}**`,                inline: true },
            { name: 'XP',     value: `**${xp.toLocaleString()}**`,  inline: true },
            { name: 'Rank',   value: rank ? `**#${rank}**` : 'Unranked', inline: true },
            { name: `Progress to Level ${level + 1}`, value: `\`${xpBar(currentXP < 0 ? 0 : currentXP, needed)}\` ${Math.max(0,currentXP).toLocaleString()} / ${needed.toLocaleString()} XP` },
          )],
      });
    }

    if (sub === 'leaderboard') {
      await interaction.deferReply();
      const lb = db.getLevelLeaderboard(guildId);
      if (!lb.length) return interaction.editReply({ content: 'No level data yet!' });

      const lines = await Promise.all(lb.map(async (e, i) => {
        const u    = await client.users.fetch(e.userId).catch(() => null);
        const name = u ? u.username : e.userId;
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**${i + 1}.**`;
        return `${medal} ${name} — Level **${e.level}** (${e.xp.toLocaleString()} XP)`;
      }));

      return interaction.editReply({
        embeds: [botEmbed('#c9b8f5').setTitle('🏆 XP Leaderboard').setDescription(lines.join('\n')).setTimestamp()],
      });
    }

    if (sub === 'config') {
      const enabled        = interaction.options.getBoolean('enabled');
      const channel        = interaction.options.getChannel('levelup_channel');
      const message        = interaction.options.getString('levelup_message');
      const disableLevelUp = interaction.options.getBoolean('disable_levelup');

      const update = {};
      if (enabled        !== null)  update.enabled          = enabled;
      if (channel)                  update.levelUpChannel   = channel.id;
      if (message)                  update.levelUpMessage   = message;
      if (disableLevelUp !== null)  update.levelUpChannel   = disableLevelUp ? false : undefined;

      if (!Object.keys(update).length) {
        const cur = db.getLevelSettings(guildId);
        return interaction.reply({
          embeds: [botEmbed().setTitle('⚙️ Level Settings')
            .addFields(
              { name: 'Enabled',          value: String(cur.enabled !== false),              inline: true },
              { name: 'Level-up Channel', value: cur.levelUpChannel === false ? 'Disabled' : cur.levelUpChannel ? `<#${cur.levelUpChannel}>` : 'Same channel', inline: true },
              { name: 'Custom Message',   value: cur.levelUpMessage || '*(default)*',        inline: false },
            )],
          ephemeral: true,
        });
      }

      db.setLevelSettings(guildId, update);
      return interaction.reply({ content: '✅ Level settings updated.', ephemeral: true });
    }

    if (sub === 'setlevel') {
      const target = interaction.options.getUser('user');
      const level  = interaction.options.getInteger('level');
      const dbData = db.getLevelUser(guildId, target.id);
      // Calculate total XP for that level
      let totalXP = 0;
      for (let i = 1; i <= level; i++) totalXP += db.xpForLevel(i);
      const levelDb = require('../database/db');
      const raw = levelDb.loadDB('levels');
      raw[guildId] ??= {};
      raw[guildId][target.id] = { xp: totalXP, level, lastXP: dbData.lastXP };
      levelDb.saveDB('levels', raw);
      return interaction.reply({ content: `✅ Set ${target.username}'s level to **${level}** (${totalXP.toLocaleString()} XP).`, ephemeral: true });
    }

    if (sub === 'setxp') {
      const target = interaction.options.getUser('user');
      const xp     = interaction.options.getInteger('xp');
      const raw    = db.loadDB('levels');
      raw[guildId] ??= {};
      raw[guildId][target.id] ??= { xp: 0, level: 0, lastXP: 0 };
      // Recalculate level from XP
      let level = 0;
      let remaining = xp;
      while (remaining >= db.xpForLevel(level + 1)) {
        remaining -= db.xpForLevel(level + 1);
        level++;
      }
      raw[guildId][target.id] = { xp, level, lastXP: raw[guildId][target.id].lastXP };
      db.saveDB('levels', raw);
      return interaction.reply({ content: `✅ Set ${target.username}'s XP to **${xp.toLocaleString()}** (Level ${level}).`, ephemeral: true });
    }

    if (sub === 'reset') {
      const target = interaction.options.getUser('user');
      const raw    = db.loadDB('levels');
      if (raw[guildId]?.[target.id]) delete raw[guildId][target.id];
      db.saveDB('levels', raw);
      return interaction.reply({ content: `✅ Reset **${target.username}**'s level data.`, ephemeral: true });
    }
  },
};
