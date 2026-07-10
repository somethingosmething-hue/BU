const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('test')
        .setDescription('Echo a message (dev/testing use)')
        .addStringOption(o => o.setName('message').setDescription('Message to echo').setRequired(true)),

    async execute(interaction) {
        const msg = interaction.options.getString('message');
        return interaction.reply({ content: msg });
    },
};
