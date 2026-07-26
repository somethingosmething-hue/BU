const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  permissions: ['ManageGuild'],
  data: new SlashCommandBuilder()
    .setName('createrolesmenu')
    .setDescription('Learn how to create a role selection menu'),

  async execute(interaction) {
    const payload = {
      flags: 32768,
      components: [
        {
          type: 17,
          components: [
            {
              type: 10,
              content: "# <:garrow:1530759025753456681> Custom Role Menus\n\n<a:blahajspin:1525312222979559464> To create a role menu, use `,crm [max selectable roles] [boolean spacing before menu - optional] [\"header\"] [\"banner url\" (optional)] [\\n'd roles] [spec]`\n\n1. Max selectable roles: How many roles from menu can be chosen at maximum.\n2. [TRUE/FALSE] whether or not to add a gap before menu, useful if there's one before it.\n3. \"Header:\" The visible title of the role menu.\n4. \"Banner URL:\" Optional banner (image/gif) to show at the top.\n5. For each role in the menu, make a new line: \"@Role/RoleID [emoji - optional]\"\n\n<:dotred:1507131042278932492> **A menu can have a maximum of twenty-five (25) roles.**\n\n### <:hawo:1490521492696465519> Example:\n```\n,crm 3 false \"ꕤ Location Roles\" \"url\"\n@North America 🌎\n@South America 🌎\n@Europe\n@Africa\n@Asia\n@Australia 🌏\n```\n-# Note that spacing boolean is optional; is fine unspecified.\n\n## <:garrow:1530759025753456681> Special Traits\nAdd `spec:xxx` below the role lines (seperate specs by new lines) to give the menu special traits:\n\n↝ `spec:disallow:messageLink`: user cannot select role if they already have from menu from specified message.\n↝ `spec:disallow:all`: user cannot select role if they have from any role menu in current channel.\n\n↝ `spec:requires:roleID`: user can only select role if they have specified role.\n↝ `spec:requires:roleID+roleID2+...` same as above, but needs all specified roles.\n↝ `spec:requires:roleID/roleID2/...` same as above, but needs at least one specified role.\n\n↝ `spec:requires:booster`: user needs to be a current server booster to select a role.\n↝ `spec:requires:adminstrator`: user needs administrator permissions to select a role.\n\n↝ `spec:run:delroles`: if they select a role, they will no longer have any other roles from the same channel.\n↝ `spec:run:recheck`: rechecks conditions above it if one fails. Good for if you use delrole.\n\n↝ `spec:customize:lim:[number]`: sets the maximum roles shown on container's list. default is 12, max 25\n↝ `spec:customize:error:[text]`: sets custom error message if you don't pass all conditions, replacing default.\n\n### <:hawo:1490521492696465519> Example 1:\n```\n[...]\n@RedGradientColorRole 🍎\nspec:disallow:all\nspec:run:delroles\nspec:requires:booster\n```\n-# The above lets a user select a red gradient color role if they have no other roles from the channel selected, and has boosted. If they have another color role from the channel the role menu is in, it will be removed so they can select the red gradient.\n\n### <:hawo:1490521492696465519> Example 2:\n```\n[...]\n@CustomAdminRole 👀\nspec:requires:administrator\nspec:disallow:(@customModRole ID)\nspec:run:delroles\nspec:run:recheck```\n-# The above is an admin-only role. The user must has administrator permissions in the server. If someone has a custom mod role from the same channel, it's not allowed. If they have it, it's deleted and the bot checks all conditions again: they do not have the mod role now, so it passes and now they have the custom admin role. The `spec:disallow` technically is not needed because of the `spec:run:delroles,` but was put for the sake of having an example."
            }
          ]
        }
      ]
    };

    await interaction.client.rest.post(`/channels/${interaction.channelId}/messages`, { body: payload }).catch(e => console.error('[createrolesmenu] rest error:', e));
    await interaction.deferReply({ flags: 64 });
    await interaction.deleteReply().catch(() => {});
  },
};
