const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('listroles')
    .setDescription('List all roles in this server with their IDs'),

  async execute(interaction) {
    const roles = [...interaction.guild.roles.cache.values()]
      .sort((a, b) => b.position - a.position);

    const lines = roles.map(r => `<@&${r.id}> ⇢ ${r.id}`);
    const header = `### <:longcat1:1524864921051857137><:longcat2:1524864957450293378><:longcat3:1524865004799791164> __Rol__es List\n`;

    const embed = new EmbedBuilder()
      .setColor('#9EFFC0')
      .setDescription(`${header}\n${lines.join('\n')}`)
      .setFooter({ text: `${roles.length} roles total` });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
