const { SlashCommandBuilder } = require('discord.js');
const { botEmbed } = require('../utils/parser');

// A human-readable catalogue of every command the bot provides.
// Grouped by category so the output stays readable.
const COMMAND_CATALOG = [
    {
        category: '⚙️ Setup',
        commands: [
            { name: '/setup', desc: 'Initial bot configuration' },
        ],
    },
    {
        category: '📋 Embeds',
        commands: [
            { name: '/embed create',   desc: 'Create a new embed' },
            { name: '/embed send',     desc: 'Send a saved embed to a channel' },
            { name: '/embed edit',     desc: 'Interactively edit an embed' },
            { name: '/embed preview',  desc: 'Preview an embed (ephemeral)' },
            { name: '/embed list',     desc: 'List all saved embeds' },
            { name: '/embed delete',   desc: 'Delete a saved embed' },
        ],
    },
    {
        category: '✨ Divemb (Component V2 Embeds)',
        commands: [
            { name: '/divemb create',  desc: 'Create a Component V2 embed' },
            { name: '/divemb send',    desc: 'Send a divemb to a channel' },
            { name: '/divemb edit',    desc: 'Edit a divemb field' },
            { name: '/divemb preview', desc: 'Preview a divemb' },
            { name: '/divemb view',    desc: 'View divemb details' },
            { name: '/divemb list',    desc: 'List all divembs' },
            { name: '/divemb delete',  desc: 'Delete a divemb' },
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
            { name: '/button panel',     desc: 'Post a button/select panel' },
            { name: '/button remove',    desc: 'Remove a button or select' },
            { name: '/button list',      desc: 'List all buttons and selects' },
        ],
    },
    {
        category: '💬 Custom Commands',
        commands: [
            { name: '/cc add',    desc: 'Create a custom slash command' },
            { name: '/cc remove', desc: 'Remove a custom command' },
            { name: '/cc list',   desc: 'List all custom commands' },
            { name: '/cc info',   desc: 'Show details for a custom command' },
        ],
    },
    {
        category: '📦 User Variables',
        commands: [
            { name: '/cvar set',    desc: 'Set a user variable' },
            { name: '/cvar get',    desc: 'Get a user variable' },
            { name: '/cvar add',    desc: 'Add to a numeric variable' },
            { name: '/cvar remove', desc: 'Remove a variable' },
            { name: '/cvar list',   desc: 'List all variables for a user' },
            { name: '/cvar clear',  desc: 'Clear all variables for a user' },
        ],
    },
    {
        category: '💛 Reaction Events',
        commands: [
            { name: '/reactevent add',    desc: 'Watch a message for a reaction' },
            { name: '/reactevent remove', desc: 'Remove a reaction event' },
            { name: '/reactevent list',   desc: 'List all reaction events' },
            { name: '/reactevent edit',   desc: 'Edit a reaction event' },
        ],
    },
    {
        category: '💛 Reaction Roles',
        commands: [
            { name: '/reactionrole add',   desc: 'Add a reaction → role binding' },
            { name: '/reactionrole remove', desc: 'Remove a binding' },
            { name: '/reactionrole list',  desc: 'List all bindings' },
            { name: '/reactionrole clear', desc: 'Clear all bindings for a message' },
        ],
    },
    {
        category: '📈 Levels',
        commands: [
            { name: '/level rank',        desc: 'Show your (or another user\'s) rank' },
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
            { name: '/poll', desc: 'Create a poll (up to 4 options)' },
        ],
    },
    {
        category: '⏰ Reminders',
        commands: [
            { name: '/reminder set',    desc: 'Set a reminder' },
            { name: '/reminder list',   desc: 'List your reminders' },
            { name: '/reminder cancel', desc: 'Cancel a reminder' },
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
        category: '🛠️ Bot',
        commands: [
            { name: '/commands', desc: 'Show this command list' },
            { name: '/trust add',    desc: 'Grant a user trusted (admin) access' },
            { name: '/trust remove', desc: 'Revoke trusted access' },
            { name: '/trust list',   desc: 'List trusted users' },
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
                { name: 'Embeds',           value: 'embeds'       },
                { name: 'Divemb',           value: 'divemb'       },
                { name: 'Autoresponder',    value: 'ar'           },
                { name: 'Buttons',          value: 'buttons'      },
                { name: 'Custom Commands',  value: 'cc'           },
                { name: 'User Variables',   value: 'cvar'         },
                { name: 'Reaction Events',  value: 'reactevent'   },
                { name: 'Reaction Roles',   value: 'reactionrole' },
                { name: 'Levels',           value: 'levels'       },
                { name: 'Giveaways',        value: 'giveaways'    },
                { name: 'Polls',            value: 'polls'        },
                { name: 'Reminders',        value: 'reminders'    },
                { name: 'Moderation',       value: 'mod'          },
                { name: 'Bot',              value: 'bot'          },
            )
        ),

    async execute(interaction, client) {
        const filter = interaction.options.getString('category');

        // Map choice values → catalog category partial matches
        const filterMap = {
            embeds:       'Embeds',
            divemb:       'Divemb',
            ar:           'Autoresponder',
            buttons:      'Buttons',
            cc:           'Custom Commands',
            cvar:         'User Variables',
            reactevent:   'Reaction Events',
            reactionrole: 'Reaction Roles',
            levels:       'Levels',
            giveaways:    'Giveaways',
            polls:        'Polls',
            reminders:    'Reminders',
            mod:          'Moderation',
            bot:          'Bot',
        };

        const categories = filter
            ? COMMAND_CATALOG.filter(c => c.category.includes(filterMap[filter] ?? ''))
            : COMMAND_CATALOG;

        if (!categories.length) {
            return interaction.reply({ content: '❌ No commands found for that category.', ephemeral: true });
        }

        // Split into pages of up to 5 categories per embed to avoid hitting the
        // 6000-character embed limit on large full listings.
        const pages = [];
        for (let i = 0; i < categories.length; i += 5) {
            pages.push(categories.slice(i, i + 5));
        }

        const embeds = pages.map((page, idx) => {
            const embed = botEmbed('#5865F2')
                .setTitle(idx === 0 ? '📖 Command Reference' : '📖 Command Reference (continued)')
                .setFooter({ text: `${COMMAND_CATALOG.reduce((n, c) => n + c.commands.length, 0)} commands total` });

            for (const cat of page) {
                embed.addFields({
                    name: cat.category,
                    value: cat.commands.map(cmd => `\`${cmd.name}\` — ${cmd.desc}`).join('\n'),
                });
            }

            return embed;
        });

        // Discord allows up to 10 embeds per message
        return interaction.reply({ embeds: embeds.slice(0, 10), ephemeral: true });
    },
};
