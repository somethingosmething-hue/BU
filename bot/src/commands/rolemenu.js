const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  permissions: ['ManageGuild'],
  data: new SlashCommandBuilder()
    .setName('rolemenu')
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
              content: "# <:garrow:1530759025753456681> Custom Role Menus\n\n<a:blahajspin:1525312222979559464> To create a role menu, use `,crm [max selectable roles] [boolean spacing before menu[...]"
            }
          ]
        }
      ]
    };

    await interaction.client.rest.post(`/channels/${interaction.channelId}/messages`, { body: payload }).catch(e => console.error('[rolemenu] rest error:', e));
    await interaction.deferReply({ flags: 64 });
    await interaction.deleteReply().catch(() => {});
  },
};
