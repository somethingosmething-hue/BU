const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { botEmbed } = require('../utils/parser');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('variables')
    .setDescription('List all available variables and placeholders'),

  async execute(interaction, client) {
    const embed = botEmbed()
      .setTitle('📋 Variables & Placeholders')
      .setDescription('Use these in custom commands, autoresponders, and /send')
      .addFields(
        { name: '═══ User Variables ═══', value: '```\n{user_mention} - @User\n{user_name} - Username\n{user_tag} - Username#0000\n{user_id} - User ID\n{user_avatar} - Avatar URL\n```', inline: true },
        { name: '═══ Server Variables ═══', value: '```\n{server_name} - Server name\n{server_icon} - Server icon URL\n{member_count} - Member count\n```', inline: true },
        { name: '═══ Time Variables ═══', value: '```\n{date} - Today\'s date\n{time} - Current time\n{timestamp} - Unix timestamp\n{newline} - Line break\n```', inline: true },
        { name: '═══ Custom Variables ═══', value: '```\n{cvar:get:user::name} - Get user variable\n{cvar:get:global::name} - Get global variable\n{cvar:add:user::name:10} - Add to user variable\n{cvar:add:global::name:10} - Add to global variable\n{cvar:set:user::name:value} - Set user variable\n{cvar:set:global::name:value} - Set global variable\n```', inline: false },
        { name: '═══ Math & Random ═══', value: '```\n{range:1:10} - Random number 1-10\n{random:A|B|C} - Random choice\n%%user::coins%% - Get user variable\n%%global::name%% - Get global variable\n```', inline: false },
        { name: '═══ Embeds ═══', value: '```\n{embed:name} - Use saved embed\n{embed:#color} - Colored embed\n{divemb:name} - Use saved divemb\n```', inline: false },
        { name: '═══ Actions ═══', value: '```\n{addrole:RoleName} - Add role\n{removerole:RoleName} - Remove role\n{requirerole:RoleName} - Require role\n{react:emoji} - React to message\n{addbutton:name} - Add button\n{addselect:name} - Add select menu\n{addlinkbutton:Label|url} - Link button\n{cooldown:seconds} - Set cooldown\n{separator} - Add separator\n```', inline: false },
        { name: '═══ Examples ═══', value: '```yaml\n# Get user coins\nYou have {cvar:get:user::coins} coins!\n\n# Add random amount\n{cvar:add:user::coins:{range:1:10}}You won!\n\n# Random choice\nThe winner is {random:Alice|Bob|Charlie}!\n\n# Use embed\nCheck out the rules: {embed:rules}\n```', inline: false },
      );

    await interaction.reply({ embeds: [embed] });
  },
};