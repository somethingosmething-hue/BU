const { SlashCommandBuilder } = require('discord.js');
const { botEmbed } = require('../utils/parser');

const COMMAND_CATALOG = [
    {
        category: '📋 Embeds',
        commands: [
            { name: '/embed create',  desc: 'Create a new embed' },
            { name: '/embed send',    desc: 'Send a saved embed to a channel' },
            { name: '/embed edit',    desc: 'Interactively edit an embed' },
            { name: '/embed preview', desc: 'Preview an embed' },
            { name: '/embed list',    desc: 'List all saved embeds' },
            { name: '/embed delete',  desc: 'Delete a saved embed' },
        ],
    },
    {
        category: '🤖 Autoresponder',
        commands: [
            { name: '/ar add',    desc: 'Add a trigger → reply rule' },
            { name: '/ar remove', desc: 'Remove a trigger' },
            { name: '/ar list',   desc: 'List all triggers' },
            { name: '/ar info',   desc: 'Show details for a trigger' },
        ],
    },
    {
        category: '🔘 Buttons & Selects',
        commands: [
            { name: '/button add',       desc: 'Create an interactive button' },
            { name: '/button addselect', desc: 'Create a select menu' },
            { name: '/button panel',     desc: 'Post a button/select panel in a channel' },
            { name: '/button remove',    desc: 'Remove a button or select' },
            { name: '/button list',      desc: 'List all buttons and selects' },
        ],
    },
    {
        category: '💬 Custom Commands',
        commands: [
            { name: '/cc add',    desc: 'Create a custom prefix command' },
            { name: '/cc remove', desc: 'Remove a custom command' },
            { name: '/cc list',   desc: 'List all custom commands' },
            { name: '/cc info',   desc: 'Show details for a custom command' },
        ],
    },
    {
        category: '📦 Variables',
        commands: [
            { name: '/cvar set',    desc: 'Set a global or user variable' },
            { name: '/cvar get',    desc: 'Get a variable value' },
            { name: '/cvar add',    desc: 'Add to a numeric variable' },
            { name: '/cvar delete', desc: 'Delete a variable' },
            { name: '/cvar list',   desc: 'List all variables for a scope' },
        ],
    },
    {
        category: '💛 Reaction Events',
        commands: [
            { name: '/reactevent add',    desc: 'Watch a message for a reaction and trigger a response' },
            { name: '/reactevent remove', desc: 'Remove a reaction event' },
            { name: '/reactevent list',   desc: 'List all reaction events' },
            { name: '/reactevent edit',   desc: 'Edit a reaction event response' },
        ],
    },
    {
        category: '🎭 Reaction Roles',
        commands: [
            { name: '/reactionrole add',    desc: 'Add a reaction → role binding to a message' },
            { name: '/reactionrole remove', desc: 'Remove a binding' },
            { name: '/reactionrole list',   desc: 'List all bindings' },
            { name: '/reactionrole clear',  desc: 'Clear all bindings for a message' },
        ],
    },
    {
        category: '📈 Levels',
        commands: [
            { name: '/level rank',        desc: 'Show your (or another user\'s) rank card' },
            { name: '/level leaderboard', desc: 'Server XP leaderboard' },
            { name: '/level config',      desc: 'Configure the leveling system' },
            { name: '/level setlevel',    desc: 'Set a user\'s level' },
            { name: '/level setxp',       desc: 'Set a user\'s XP' },
            { name: '/level reset',       desc: 'Reset a user\'s XP and level' },
        ],
    },
    {
        category: '🎉 Giveaways',
        commands: [
            { name: '/giveaway start',  desc: 'Start a giveaway' },
            { name: '/giveaway end',    desc: 'End a giveaway early' },
            { name: '/giveaway reroll', desc: 'Reroll a giveaway winner' },
            { name: '/giveaway list',   desc: 'List active giveaways' },
        ],
    },
    {
        category: '📊 Polls',
        commands: [
            { name: '/poll', desc: 'Create a reaction poll (yes/no or up to 10 options)' },
        ],
    },
    {
        category: '⏰ Reminders',
        commands: [
            { name: '/reminder set',    desc: 'Set a reminder' },
            { name: '/reminder list',   desc: 'List your pending reminders' },
            { name: '/reminder cancel', desc: 'Cancel a reminder by ID' },
        ],
    },
    {
        category: '🔨 Moderation',
        commands: [
            { name: '/mod ban',       desc: 'Ban a member' },
            { name: '/mod unban',     desc: 'Unban a user by ID' },
            { name: '/mod kick',      desc: 'Kick a member' },
            { name: '/mod timeout',   desc: 'Timeout a member' },
            { name: '/mod untimeout', desc: 'Remove a timeout' },
            { name: '/mod warn',      desc: 'Warn a member' },
            { name: '/mod warnings',  desc: 'View a member\'s warnings' },
            { name: '/mod delwarn',   desc: 'Delete a warning by ID' },
            { name: '/mod purge',     desc: 'Bulk delete messages' },
            { name: '/mod slowmode',  desc: 'Set channel slowmode' },
            { name: '/mod lock',      desc: 'Lock a channel' },
            { name: '/mod unlock',    desc: 'Unlock a channel' },
            { name: '/mod nickname',  desc: 'Change a member\'s nickname' },
            { name: '/mod modlogs',   desc: 'View moderation history' },
        ],
    },
    {
        category: '⚙️ Bot Config',
        commands: [
            { name: '/prefix',        desc: 'Set the prefix for custom commands' },
            { name: '/trust add',     desc: 'Grant a user trusted (admin) access to all bot commands' },
            { name: '/trust remove',  desc: 'Revoke trusted access' },
            { name: '/trust list',    desc: 'List trusted users' },
            { name: '/commands',      desc: 'Show this command reference' },
        ],
    },
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('commands')
        .setDescription('Show all available bot commands')
        .addStringOption(o => o
            .setName('category')
            .setDescription('Filter to a specific category')
            .setRequired(false)
            .addChoices(
                { name: 'Embeds',          value: 'Embeds'         },
                { name: 'Autoresponder',   value: 'Autoresponder'  },
                { name: 'Buttons',         value: 'Buttons'        },
                { name: 'Custom Commands', value: 'Custom Commands'},
                { name: 'Variables',       value: 'Variables'      },
                { name: 'Reaction Events', value: 'Reaction Events'},
                { name: 'Reaction Roles',  value: 'Reaction Roles' },
                { name: 'Levels',          value: 'Levels'         },
                { name: 'Giveaways',       value: 'Giveaways'      },
                { name: 'Polls',           value: 'Polls'          },
                { name: 'Reminders',       value: 'Reminders'      },
                { name: 'Moderation',      value: 'Moderation'     },
                { name: 'Bot Config',      value: 'Bot Config'     },
            )
        ),

    async execute(interaction) {
        const filter = interaction.options.getString('category');

        const categories = filter
            ? COMMAND_CATALOG.filter(c => c.category.includes(filter))
            : COMMAND_CATALOG;

        if (!categories.length) {
            return interaction.reply({ content: '❌ No commands found for that category.' });
        }

        const totalCommands = COMMAND_CATALOG.reduce((n, c) => n + c.commands.length, 0);

        // Split into pages of 5 categories to stay under the 6000-char embed limit
        const pages = [];
        for (let i = 0; i < categories.length; i += 5) {
            pages.push(categories.slice(i, i + 5));
        }

        const embeds = pages.map((page, idx) => {
            const embed = botEmbed('#5865F2')
                .setTitle(idx === 0 ? '📖 Command Reference' : '📖 Command Reference (cont.)')
                .setFooter({ text: `${totalCommands} commands total` });

            for (const cat of page) {
                embed.addFields({
                    name:  cat.category,
                    value: cat.commands.map(cmd => `\`${cmd.name}\` — ${cmd.desc}`).join('\n'),
                });
            }

            return embed;
        });

        return interaction.reply({ embeds: embeds.slice(0, 10) });
    },
};
