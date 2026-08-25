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
    )
    .addStringOption(option =>
      option
        .setName('reset')
        .setDescription('Reset a specific profile element')
        .setRequired(false)
        .addChoices(
          { name: 'Name', value: 'name' },
          { name: 'Profile Picture', value: 'pfp' },
          { name: 'Banner', value: 'banner' },
          { name: 'Bio', value: 'bio' },
          { name: 'All', value: 'all' }
        )
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
      const resetOption = interaction.options.getString('reset');

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
      if (!newName && !newPfp && !newBanner && !newBio && !resetOption) {
        return await interaction.reply({
          content: '❌ You must provide at least one parameter to change (name, pfp, banner, bio) or use reset.',
          flags: 64
        });
      }

      // Build profile object for database
      const profileUpdate = {};
      if (newName) profileUpdate.displayName = newName;
      if (newPfp) profileUpdate.avatar = newPfp;
      if (newBanner) profileUpdate.banner = newBanner;
      if (newBio) profileUpdate.about = newBio;

      // Handle reset option
      let resetMessage = '';
      if (resetOption) {
        if (resetOption === 'all') {
          profileUpdate.displayName = null;
          profileUpdate.avatar = null;
          profileUpdate.banner = null;
          profileUpdate.about = null;
          resetMessage = '🔄 **Resetting:** Name, PFP, Banner, Bio\n';
        } else if (resetOption === 'name') {
          profileUpdate.displayName = null;
          resetMessage = '🔄 **Resetting:** Name\n';
        } else if (resetOption === 'pfp') {
          profileUpdate.avatar = null;
          resetMessage = '🔄 **Resetting:** Profile Picture\n';
        } else if (resetOption === 'banner') {
          profileUpdate.banner = null;
          resetMessage = '🔄 **Resetting:** Banner\n';
        } else if (resetOption === 'bio') {
          profileUpdate.about = null;
          resetMessage = '🔄 **Resetting:** Bio\n';
        }
      }

      // Save to database
      await db.saveBotProfile(guildId, profileUpdate);

      // Apply changes to bot's guild member profile using editMe
      try {
        const editData = {};
        if (newName) editData.nick = newName;
        if (newBio) editData.bio = newBio;
        if (newPfp) editData.avatar = newPfp;
        if (newBanner) editData.banner = newBanner;

        // Handle resets
        if (resetOption === 'all') {
          editData.nick = null;
          editData.bio = null;
          editData.avatar = null;
          editData.banner = null;
        } else if (resetOption === 'name') {
          editData.nick = null;
        } else if (resetOption === 'bio') {
          editData.bio = null;
        } else if (resetOption === 'pfp') {
          editData.avatar = null;
        } else if (resetOption === 'banner') {
          editData.banner = null;
        }

        if (Object.keys(editData).length > 0) {
          await interaction.guild.members.editMe(editData).catch(e => {
            console.error('[disguise] Failed to update member:', e.message);
            throw e;
          });
        }
      } catch (e) {
        // Handle Discord rate limit errors
        if (e.code === 'BANNER_RATE_LIMIT' || e.message?.includes('banner') && e.message?.includes('too fast')) {
          return await interaction.reply({
            content: '⏱️ **Rate Limited:** You can only change your profile banner once in a while. Please try again later.',
            flags: 64
          });
        }
        if (e.code === 'AVATAR_RATE_LIMIT' || e.message?.includes('avatar') && e.message?.includes('too fast')) {
          return await interaction.reply({
            content: '⏱️ **Rate Limited:** You can only change your profile picture once in a while. Please try again later.',
            flags: 64
          });
        }
        if (e.message?.includes('too fast') || e.message?.includes('rate limit') || e.message?.includes('Req was rate limited')) {
          return await interaction.reply({
            content: '⏱️ **Rate Limited:** Discord is temporarily rate limiting profile updates. Please try again in a few moments.',
            flags: 64
          });
        }
        
        console.error('[disguise] Error updating guild member:', e);
        throw e;
      }

      // Build confirmation message
      let confirmMessage = '✅ **Server Profile Updated**\n\n';
      confirmMessage += resetMessage;
      if (newName) confirmMessage += `📝 **Name:** ${newName}\n`;
      if (newPfp) confirmMessage += `🖼️ **Profile Picture:** Updated\n`;
      if (newBanner) confirmMessage += `🎨 **Banner:** Updated\n`;
      if (newBio) confirmMessage += `📋 **Bio:** ${newBio}\n`;

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
