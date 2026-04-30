const { SlashCommandBuilder } = require('discord.js');
const db = require('../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roleall')
    .setDescription('Add a role to all non-bot members')
    .addRoleOption(opt =>
      opt.setName('role')
        .setDescription('Role to add to all members')
        .setRequired(true)
    ),
  async execute(interaction) {
    const guildId = interaction.guild?.id;
    const member = interaction.member;

    if (!guildId) {
      return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    }

    const trusted = await db.isTrusted(guildId, member.id);
    if (!trusted && !member.permissions.has('Administrator')) {
      return interaction.reply({ content: 'You need Administrator permission or Trusted role.', ephemeral: true });
    }

    const role = interaction.options.getRole('role');
    if (!role) {
      return interaction.reply({ content: 'Role not found.', ephemeral: true });
    }

    // Check if bot can manage this role
    const botMember = interaction.guild.members.me;
    if (role.position >= botMember.roles.highest.position) {
      return interaction.reply({ content: '❌ I cannot add that role because it is higher than my highest role.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const members = await interaction.guild.members.fetch();
      const nonBotMembers = members.filter(m => !m.user.bot);
      const membersToUpdate = nonBotMembers.filter(m => !m.roles.cache.has(role.id));

      if (membersToUpdate.size === 0) {
        return interaction.editReply({ content: `All non-bot members already have the ${role.name} role.` });
      }

      let addedCount = 0;
      let failedCount = 0;

      for (const member of membersToUpdate.values()) {
        try {
          await member.roles.add(role);
          addedCount++;
        } catch (error) {
          failedCount++;
          console.error(`Failed to add role to ${member.user.tag}:`, error.message);
        }
      }

      await interaction.editReply({ content: `✅ Added ${role.name} to ${addedCount} member(s). Failed: ${failedCount}`, ephemeral: true });
    } catch (error) {
      console.error('Error in roleall:', error);
      await interaction.editReply({ content: '❌ Failed to fetch members or add roles.', ephemeral: true });
    }
  },
};
