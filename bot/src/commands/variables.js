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
        { name: '═══ User Variables ═══', value: '```\n{user} - @User\n{user_mention} - @User\n{user_name} - Username\n{user_tag} - Username#0000\n{user_id} - User ID\n{user_avatar} - Avatar URL\n{user_nick} - Server nickname\n{user_joindate} - Join date\n{user_createdate} - Account created\n{user_displaycolor} - Hex color\n```', inline: true },
        { name: '═══ Server Variables ═══', value: '```\n{server_name} - Server name\n{server_id} - Server ID\n{server_icon} - Server icon\n{member_count} - Member count\n{server_membercount} - Member count\n{server_membercount_nobots} - Members (no bots)\n{server_botcount} - Bot count\n{server_owner} - @Owner\n{server_owner_id} - Owner ID\n{server_rolecount} - Role count\n{server_channelcount} - Channel count\n```', inline: true },
        { name: '═══ Channel & Message ═══', value: '```\n{channel} - #channel\n{channel_name} - Channel name\n{message_id} - Message ID\n{message_content} - Message text\n{message_link} - Message URL\n```', inline: true },
        { name: '═══ Time & Misc ═══', value: '```\n{date} - Today\'s date\n{time} - Current time\n{timestamp} - Unix timestamp\n{newline} - Line break\n```', inline: true },
        { name: '═══ Custom Variables ═══', value: '```\n{cvar:get:user::name} - Get user variable\n{cvar:get:global::name} - Get global variable\n{cvar:add:user::name:10} - Add to user variable\n{cvar:add:global::name:10} - Add to global variable\n{cvar:set:user::name:value} - Set user variable\n{cvar:set:global::name:value} - Set global variable\n```', inline: false },
        { name: '═══ Math & Random ═══', value: '```\n{range:1:10} - Random number 1-10\n{random:A|B|C} - Random choice\n{choose:A|B|C} - Random choice\n%%user::coins%% - Get user variable\n%%global::name%% - Get global variable\n```', inline: false },
        { name: '═══ Embeds ═══', value: '```\n{embed:name} - Use saved embed\n{embed:#color} - Colored embed\n{divemb:name} - Use saved divemb\n{dm} - Send in DM\n{sendto:#channel} - Send to channel\n```', inline: false },
        { name: '═══ Restrict Access ═══', value: '```\n{requireuser:user} - Require user\n{requirechannel:#ch} - Require channel\n{requirerole:Role} - Require role\n{denychannel:#ch} - Deny channel\n{denyrole:Role} - Deny role\n{cooldown:seconds} - Set cooldown\n```', inline: false },
        { name: '═══ Actions ═══', value: '```\n{addrole:RoleName} - Add role\n{removerole:RoleName} - Remove role\n{setnick:name} - Set nickname\n{react:emoji} - React to message\n{reactreply:emoji} - React to reply\n{addbutton:name} - Add button\n{addselect:name} - Add select menu\n{addlinkbutton:Label|url} - Link button\n{separator} - Add separator\n```', inline: false },
        { name: '═══ Examples ═══', value: '```yaml\n# Get user coins\nYou have {cvar:get:user::coins} coins!\n\n# Add random amount\n{cvar:add:user::coins:{range:1:10}}You won!\n\n# Random choice\nThe winner is {random:Alice|Bob|Charlie}!\n\n# Use embed\nCheck out the rules: {embed:rules}\n\n# Require role\n{requirerole:VIP} Only VIPs can use this!\n```', inline: false },
      );

    await interaction.reply({ embeds: [embed] });
  },
};