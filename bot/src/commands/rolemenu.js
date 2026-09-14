const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  permissions: ['ManageGuild'],
  data: new SlashCommandBuilder()
    .setName('rolemenu')
    .setDescription('Learn how to create a role selection menu'),

  async execute(interaction) {
    const full = require('./createrolesmenu.js');
    return full.execute(interaction);
  },
};
