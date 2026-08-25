const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  permissions: ['ManageGuild'],
  data: new SlashCommandBuilder()
    .setName('disguise')
    .setDescription('Change the bot\'s per-server profile (name, avatar, banner, bio)')
    .addStringOption(option =>
      option
        .setName('name')
        .setDescription('Bot display name for this server')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('pfp_url')
        .setDescription('Profile picture URL')
        .setRequired(false)
    )
    .addAttachmentOption(option =>
      option
        .setName('pfp_upload')
        .setDescription('Profile picture image file')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('banner_url')
        .setDescription('Banner image URL')
        .setRequired(false)
    )
    .addAttachmentOption(option =>
      option
        .setName('banner_upload')
        .setDescription('Banner image file')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('bio')
        .setDescription('About me / bio text for this server')
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
      // Check permissions
      if (!interaction.member.permissions.has('ManageGuild')) {
        return await interaction.reply({
          content: '❌ You need the **Manage Guild** permission to use this command.',
          flags: 64
        });
      }

      const db = require('../database/db');
      const guildId = interaction.guildId;

      // Get the new values from options
      const newName = interaction.options.getString('name');
      const pfpUrl = interaction.options.getString('pfp_url');
      const pfpUpload = interaction.options.getAttachment('pfp_upload');
      const bannerUrl = interaction.options.getString('banner_url');
      const bannerUpload = interaction.options.getAttachment('banner_upload');
      const newBio = interaction.options.getString('bio');

      // Validate pfp - either URL or upload
      let newPfp = null;
      if (pfpUrl && pfpUpload) {
        return await interaction.reply({
          content: '❌ You can only provide either a URL or an upload for the profile picture, not both.',
          flags: 64
        });
      }
      if (pfpUrl) newPfp = pfpUrl;
      if (pfpUpload) newPfp = pfpUpload.url;

      // Validate banner - either URL or upload
      let newBanner = null;
      if (bannerUrl && bannerUpload) {
        return await interaction.reply({
          content: '❌ You can only provide either a URL or an upload for the banner, not both.',
          flags: 64
        });
      }
      if (bannerUrl) newBanner = bannerUrl;
      if (bannerUpload) newBanner = bannerUpload.url;

      // Check if at least one option was provided
      if (!newName && !newPfp && !newBanner && !newBio) {
        return await interaction.reply({
          content: '❌ You must provide at least one parameter to change (name, pfp, banner, or bio).',
          flags: 64
        });
      }

      // Build profile object
      const profileUpdate = {};
      if (newName) profileUpdate.displayName = newName;
      if (newPfp) profileUpdate.avatar = newPfp;
      if (newBanner) profileUpdate.banner = newBanner;
      if (newBio) profileUpdate.about = newBio;

      // Save to database
      await db.saveBotProfile(guildId, profileUpdate);

      // Try to apply changes to guild member
      try {
        const guildMember = interaction.guild?.members.cache.get(interaction.client.user.id);
        if (guildMember) {
          const editData = {};
          if (newName) editData.nick = newName;
          if (Object.keys(editData).length > 0) {
            await guildMember.edit(editData).catch(e => console.error('Failed to update member:', e));
          }
        }
      } catch (e) {
        console.error('Error updating guild member:', e);
      }

      // Build confirmation message
      let confirmMessage = '✅ **Server Profile Updated**\n\n';
      if (newName) confirmMessage += `📝 **Name:** ${newName}\n`;
      if (newPfp) confirmMessage += `🖼️ **Profile Picture:** Updated\n`;
      if (newBanner) confirmMessage += `🎨 **Banner:** Updated\n`;
      if (newBio) confirmMessage += `📋 **Bio:** ${newBio}\n`;
      confirmMessage += '\n*Note: Avatar and banner changes are stored but Discord only supports per-server nicknames. Avatar/banner would need custom display in embeds.*';

      await interaction.reply({
        content: confirmMessage,
        flags: 64
      });

    } catch (error) {
      console.error('[disguise] error:', error);
      await interaction.reply({
        content: '❌ An error occurred while updating your server profile.',
        flags: 64
      });
    }
  }
};
