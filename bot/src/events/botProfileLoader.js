const db = require('../database/db');

module.exports = {
  name: 'guildCreate',
  once: false,
  async execute(guild, client) {
    try {
      // Load and apply saved bot profile for this guild
      const profile = await db.getBotProfile(guild.id);
      if (profile) {
        const botMember = guild.members.cache.get(client.user.id);
        if (botMember && profile.displayName) {
          await botMember.edit({ nick: profile.displayName }).catch(e => 
            console.error(`[botProfileLoader] Failed to set nickname in ${guild.id}:`, e.message)
          );
          console.log(`[botProfileLoader] Applied profile to new guild ${guild.id}: ${profile.displayName}`);
        }
      }
    } catch (error) {
      console.error('[botProfileLoader] guildCreate error:', error);
    }
  }
};
