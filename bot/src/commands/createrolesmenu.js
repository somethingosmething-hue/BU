const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  permissions: ['ManageGuild'],
  data: new SlashCommandBuilder()
    .setName('createrolesmenu')
    .setDescription('Learn how to create a role selection menu'),

  async execute(interaction) {
    const text = `# <:garrow:1530759025753456681> Custom Role Menus

<a:blahajspin:1525312222979559464> To create a role menu, use \`,crm [max selectable roles] [boolean spacing before menu - optional] ["header"] ["banner url" (optional)] [\n'd roles] [spec]\`

1. Max selectable roles: How many roles from menu can be chosen at maximum.
2. [TRUE/FALSE] whether or not to add a gap before menu, useful if there's one before it.
3. "Header:" The visible title of the role menu.
4. "Banner URL:" Optional banner (image/gif) to show at the top.
5. For each role in the menu, make a new line: "@Role/RoleID [emoji - optional]"

### <:hawo:1490521492696465519> Example:
\`\`\`
,crm 3 false "ꕤ Location Roles" "url"
@North America 🌎
@South America 🌎
@Europe
@Africa
@Asia
@Australia 🌏
\`\`\`
-# Note that spacing boolean is optional; is fine unspecified.

## <:garrow:1530759025753456681> Special Traits
Add \`spec:xxx\` below the role lines (seperate specs by new lines) to give the menu special traits:

↝ \`spec:disallow:messageLink\`: user cannot select role if they already have from menu from specified message.
↝ \`spec:disallow:all\`: user cannot select role if they have from any role menu in current channel.

↝ \`spec:requires:roleID\`: user can only select role if they have specified role.
↝ \`spec:requires:roleID+roleID2+...\` same as above, but needs all specified roles.
↝ \`spec:requires:roleID/roleID2/...\` same as above, but needs at least one specified role.

↝ \`spec:requires:booster\`: user needs to be a current server booster to select a role.
↝ \`spec:requires:adminstrator\`: user needs administrator permissions to select a role.

↝ \`spec:run:delroles\`: if they select a role, they will no longer have any other roles from the same channel.
↝ \`spec:run:recheck\`: rechecks conditions above it if one fails. Good for if you use delrole.

↝ \`spec:customlim:[number]\`: sets the maximum roles shown on container's list. default is 12.

### <:hawo:1490521492696465519> Example 1:
\`\`\`
[...]
@RedGradientColorRole 🍎
spec:disallow:all
spec:run:delroles
spec:requires:booster
\`\`\`
-# The above lets a user select a red gradient color role if they have no other roles from the channel selected, and has boosted. If they have another color role from the channel the role menu is in, it will be removed so they can select the red gradient.

### <:hawo:1490521492696465519> Example 2:
\`\`\`
[...]
@CustomAdminRole 👀
spec:requires:administrator
spec:disallow:(@customModRole ID)
spec:run:delroles
spec:run:recheck\`\`\`
-# The above is an admin-only role. The user must has administrator permissions in the server. If someone has a custom mod role from the same channel, it's not allowed. If they have it, it's deleted and the bot checks all conditions again: they do not have the mod role now, so it passes and now they have the custom admin role. The \`spec:disallow\` technically is not needed because of the \`spec:run:delroles,\` but was put for the sake of having an example.`;

    await interaction.reply({
      flags: 64,
      components: [{
        type: 17,
        components: [{ type: 10, content: text }],
      }],
    }).catch(e => console.error('[createrolesmenu] reply error:', e));
  },
};
