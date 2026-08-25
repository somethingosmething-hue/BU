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
        .setName('pfp')
        .setDescription('Profile picture URL or file link')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('banner')
        .setDescription('Banner image URL or file link')
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
      const newPfp = interaction.options.getString('pfp');
      const newBanner = interaction.options.getString('banner');
      const newBio = interaction.options.getString('bio');

      // Check if at least one option was provided
      if (!newName && !newPfp && !newBanner && !newBio) {
        return await interaction.reply({
          content: '❌ You must provide at least one parameter to change (name, pfp, banner, or bio).',
          flags: 64
        });
      }

      // Get existing profile or create new one
      const profileCollection = db.getCollection('serverProfiles');
      const existingProfile = await profileCollection.findOne({ guildId });

      const updatedProfile = {
        guildId,
        ...(newName && { displayName: newName }),
        ...(newPfp && { avatar: newPfp }),
        ...(newBanner && { banner: newBanner }),
        ...(newBio && { about: newBio }),
        updatedAt: Date.now()
      };

      if (existingProfile) {
        await profileCollection.updateOne(
          { guildId },
          { $set: updatedProfile }
        );
      } else {
        await profileCollection.insertOne(updatedProfile);
      }

      // Build confirmation message
      let confirmMessage = '✅ **Server Profile Updated**\n\n';
      if (newName) confirmMessage += `📝 **Name:** ${newName}\n`;
      if (newPfp) confirmMessage += `🖼️ **Profile Picture:** ${newPfp}\n`;
      if (newBanner) confirmMessage += `🎨 **Banner:** ${newBanner}\n`;
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
