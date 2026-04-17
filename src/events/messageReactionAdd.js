const { parseReply, resolveRole } = require('../utils/parser');
const db = require('../database/db');

module.exports = {
  name: 'messageReactionAdd',
  async execute(reaction, user, client) {
    if (user.bot) return;

    const guild = reaction.message.guild;
    if (!guild) return;

    const guildId = guild.id;
    const messageId = reaction.message.id;
    const emojiStr = reaction.emoji.toString();

    const trigger = db.getReactionTrigger(guildId, messageId, emojiStr);
    if (!trigger) return;

    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) return;

    const context = {
      member,
      guild,
      guildId,
      user,
    };

    const parsed = await parseReply(trigger.response, context);

    if (parsed.requireRole) {
      const role = resolveRole(guild, parsed.requireRole);
      if (role && !member.roles.cache.has(role.id)) {
        await reaction.message.reply({ content: `❌ You need the **${role.name}** role!`, ephemeral: true }).catch(() => {});
        return;
      }
    }

    for (const action of parsed.actions) {
      if (action.type === 'addrole' || action.type === 'remove_role') {
        const role = resolveRole(guild, action.value);
        if (!role) continue;
        try {
          if (action.type === 'addrole') await member.roles.add(role);
          if (action.type === 'remove_role') await member.roles.remove(role);
        } catch (e) {
          console.error('Role action failed:', e.message);
        }
      } else if (action.type === 'setvar') {
        const [varName, op, val] = action.value.split(':');
        const current = db.getUserVar(guildId, member.id, varName);
        const currentNum = parseInt(current) || 0;
        const addVal = parseInt(val) || 0;
        db.setUserVar(guildId, member.id, varName, currentNum + addVal);
      }
    }

    const channel = reaction.message.channel;

    if (trigger.action === 'reply') {
      const payload = {};
      if (parsed.text) payload.content = parsed.text;
      if (parsed.embed) payload.embeds = [parsed.embed];
      if (parsed.rows.length) payload.components = parsed.rows;
      if (Object.keys(payload).length > 0) {
        await channel.send(payload).catch(console.error);
      }
    } else if (trigger.action === 'send') {
      const targetChannel = trigger.channelId ? guild.channels.cache.get(trigger.channelId) : channel;
      if (targetChannel) {
        const payload = {};
        if (parsed.text) payload.content = parsed.text;
        if (parsed.embed) payload.embeds = [parsed.embed];
        if (parsed.rows.length) payload.components = parsed.rows;
        await targetChannel.send(payload).catch(console.error);
      }
    }
  },
};