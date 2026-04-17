const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Create a reaction poll')
    .addStringOption(o => o.setName('question').setDescription('Poll question').setRequired(true))
    .addStringOption(o => o.setName('options').setDescription('Options separated by | (leave empty for yes/no)')),

  async execute(interaction) {
    const question = interaction.options.getString('question');
    const optStr   = interaction.options.getString('options');
    const guildId  = interaction.guildId;

    const NUMBER_EMOJIS = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];

    let options = null;
    if (optStr) {
      options = optStr.split('|').map(o => o.trim()).filter(Boolean).slice(0, 10);
      if (options.length < 2) return interaction.reply({ content: '❌ Provide at least 2 options separated by `|`.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('📊 ' + question)
      .setFooter({ text: `Poll by ${interaction.user.username}` })
      .setTimestamp();

    if (options) {
      embed.setDescription(options.map((o, i) => `${NUMBER_EMOJIS[i]} ${o}`).join('\n'));
    } else {
      embed.setDescription('React with 👍 or 👎');
    }

    await interaction.reply({ embeds: [embed] });
    const msg = await interaction.fetchReply();

    if (options) {
      for (let i = 0; i < options.length; i++) await msg.react(NUMBER_EMOJIS[i]).catch(() => {});
    } else {
      await msg.react('👍').catch(() => {});
      await msg.react('👎').catch(() => {});
    }

    db.savePoll(guildId, msg.id, { question, options, messageId: msg.id, channelId: msg.channel.id });
  },
};
