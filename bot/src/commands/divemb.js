const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../database/db');
const { buildDivembFromData, botEmbed } = require('../utils/parser');

module.exports = {
  permissions: ['ManageGuild'],
  data: new SlashCommandBuilder()
    .setName('divemb')
    .setDescription('Manage divemb (Message Components V2)')
    .addSubcommand(s => s.setName('create').setDescription('Create a new divemb')
      .addStringOption(o => o.setName('name').setDescription('Divemb name').setRequired(true))
      .addStringOption(o => o.setName('title').setDescription('Title'))
      .addStringOption(o => o.setName('description').setDescription('Description'))
      .addStringOption(o => o.setName('color').setDescription('Color (#hex)'))
      .addStringOption(o => o.setName('footer').setDescription('Footer text'))
      .addStringOption(o => o.setName('image').setDescription('Image URL'))
      .addStringOption(o => o.setName('thumbnail').setDescription('Thumbnail URL'))
      .addStringOption(o => o.setName('author').setDescription('Author name'))
      .addStringOption(o => o.setName('url').setDescription('Title URL')))
    .addSubcommand(s => s.setName('edit').setDescription('Edit a divemb field')
      .addStringOption(o => o.setName('name').setDescription('Divemb name').setRequired(true))
      .addStringOption(o => o.setName('field').setDescription('Field to edit (title, description, color, footer, image, thumbnail, author, url)').setRequired(true))
      .addStringOption(o => o.setName('value').setDescription('New value (use "|" separator for add_field)').setRequired(true)))
    .addSubcommand(s => s.setName('send').setDescription('Send a divemb to a channel')
      .addStringOption(o => o.setName('name').setDescription('Divemb name').setRequired(true))
      .addChannelOption(o => o.setName('channel').setDescription('Channel to send to (defaults to current)')))
    .addSubcommand(s => s.setName('delete').setDescription('Delete a divemb')
      .addStringOption(o => o.setName('name').setDescription('Divemb name').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('List all divembs'))
    .addSubcommand(s => s.setName('preview').setDescription('Preview a divemb')
      .addStringOption(o => o.setName('name').setDescription('Divemb name').setRequired(true)))
    .addSubcommand(s => s.setName('view').setDescription('View a divemb raw data')
      .addStringOption(o => o.setName('name').setDescription('Divemb name').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const name = interaction.options.getString('name');

    if (sub === 'create') {
      const data = {};
      const title = interaction.options.getString('title');
      const description = interaction.options.getString('description');
      const color = interaction.options.getString('color');
      const footer = interaction.options.getString('footer');
      const image = interaction.options.getString('image');
      const thumbnail = interaction.options.getString('thumbnail');
      const author = interaction.options.getString('author');
      const url = interaction.options.getString('url');

      if (color) data.color = color;
      if (title) data.title = title;
      if (description) data.description = description;
      if (footer) data.footer = footer;
      if (image) data.image = image;
      if (thumbnail) data.thumbnail = thumbnail;
      if (author) data.author = author;
      if (url) data.url = url;

      await db.saveDivemb(guildId, name, data);
      return interaction.reply({ embeds: [botEmbed('#77dd77').setDescription(`✅ Divemb **${name}** created.`)] });
    }

    if (sub === 'edit') {
      const field = interaction.options.getString('field');
      const value = interaction.options.getString('value');

      const existing = await db.getDivemb(guildId, name);
      if (!existing) return interaction.reply({ content: '❌ Divemb not found.' });

      if (field === 'add_field') {
        const parts = value.split('|').map(s => s.trim());
        if (parts.length < 2) return interaction.reply({ content: '❌ Use: Field Name|Field Value|true' });
        existing.fields ??= [];
        existing.fields.push({ name: parts[0], value: parts[1], inline: parts[2] === 'true' });
      } else {
        existing[field] = value;
      }

      await db.saveDivemb(guildId, name, existing);
      return interaction.reply({ embeds: [botEmbed('#77dd77').setDescription(`✅ Divemb **${name}** ${field === 'add_field' ? 'field added' : `${field} updated`}.`)] });
    }

    if (sub === 'send') {
      const channel = interaction.options.getChannel('channel') || interaction.channel;
      const existing = await db.getDivemb(guildId, name);
      if (!existing) return interaction.reply({ content: '❌ Divemb not found.' });

      const embed = buildDivembFromData(existing);
      await channel.send({ embeds: [embed] });
      return interaction.reply({ content: `✅ Divemb **${name}** sent to ${channel}.`, ephemeral: true });
    }

    if (sub === 'delete') {
      const existing = await db.getDivemb(guildId, name);
      if (!existing) return interaction.reply({ content: '❌ Divemb not found.' });

      await db.deleteDivemb(guildId, name);
      return interaction.reply({ embeds: [botEmbed('#ff6b6b').setDescription(`🗑️ Divemb **${name}** deleted.`)] });
    }

    if (sub === 'list') {
      const all = await db.getDivembs(guildId);
      const entries = Object.keys(all);
      if (!entries.length) return interaction.reply({ content: '📭 No divembs.' });

      const lines = entries.map(n => {
        const d = all[n];
        return `• **${n}** — ${d.title || 'no title'}`;
      });

      return interaction.reply({
        embeds: [botEmbed('#c9b8f5').setTitle(`📋 Divembs (${entries.length})`).setDescription(lines.join('\n'))],
      });
    }

    if (sub === 'preview') {
      const existing = await db.getDivemb(guildId, name);
      if (!existing) return interaction.reply({ content: '❌ Divemb not found.' });

      const embed = buildDivembFromData(existing);
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'view') {
      const existing = await db.getDivemb(guildId, name);
      if (!existing) return interaction.reply({ content: '❌ Divemb not found.' });

      const lines = Object.entries(existing).map(([k, v]) => {
        const val = typeof v === 'string' ? v : JSON.stringify(v);
        return `**${k}:** ${val}`;
      });

      return interaction.reply({
        embeds: [botEmbed('#c9b8f5').setTitle(`📄 Divemb: ${name}`).setDescription(lines.join('\n'))],
        ephemeral: true,
      });
    }
  },
};