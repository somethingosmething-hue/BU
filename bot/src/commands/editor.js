const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const EDITOR_URL = process.env.EDITOR_URL || 'https://catboy-amber.vercel.app';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('editor')
    .setDescription('Get the web dashboard link')
    .addSubcommand(sub =>
      sub.setName('password')
        .setDescription('Set the web dashboard password')
        .addStringOption(o => o.setName('password').setDescription('New password').setRequired(true))
    ),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'password') {
      const password = interaction.options.getString('password');
      const embed = new EmbedBuilder()
        .setTitle('📊 Editor Password Set')
        .setDescription(`**[Open Dashboard](${EDITOR_URL}/?guild=${guildId})**`)
        .addFields(
          { name: 'Server ID', value: `\`${guildId}\``, inline: true },
          { name: 'Password', value: `\`${password}\``, inline: true }
        )
        .setColor('#23a55a');
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('📊 Mimu Dashboard')
      .setDescription(`**[Open Dashboard](${EDITOR_URL}/?guild=${guildId})**`)
      .addFields(
        { name: 'Server ID', value: `\`${guildId}\``, inline: true },
        { name: 'Password', value: 'Use `/editor password [password]` to set', inline: true }
      )
      .setColor('#5865F2');

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};