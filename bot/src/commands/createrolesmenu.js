const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  permissions: ['ManageGuild'],
  data: new SlashCommandBuilder()
    .setName('createrolesmenu')
    .setDescription('Learn how to create a role selection menu'),

  async execute(interaction) {
    const msg = `To create a role menu, send \`,crm ["header"] [max roles selectable] ["banner url - optional"] ["newline'd roles. optional icons next to them"]\nFor example:

\`\`\`
,crm 3 "ꕤ Location Roles" "url"
@North America 🌎
@South America 🌎
@Europe 🌍
@Africa 🌍
@Asia 🌏
@Australia 🌏
\`\`\`

It will send to your current channel.`;

    await interaction.reply({ content: msg, flags: 64 });
  },
};
