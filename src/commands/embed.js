const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const db = require('../database/db');
const { buildEmbedFromData, botEmbed } = require('../utils/parser');

const EDIT_FIELDS = [
  { id: 'title', label: 'Title' },
  { id: 'description', label: 'Description' },
  { id: 'color', label: 'Color' },
  { id: 'footer', label: 'Footer' },
  { id: 'image', label: 'Image' },
  { id: 'thumbnail', label: 'Thumbnail' },
  { id: 'author', label: 'Author' },
  { id: 'url', label: 'URL' },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Create and manage embeds')
    .setDefaultMemberPermissions(0x20)
    .addSubcommand(s => s.setName('create').setDescription('Create a new embed')
      .addStringOption(o => o.setName('name').setDescription('Embed name').setRequired(true))
      .addStringOption(o => o.setName('title').setDescription('Title'))
      .addStringOption(o => o.setName('description').setDescription('Description'))
      .addStringOption(o => o.setName('color').setDescription('Color (#hex)'))
      .addStringOption(o => o.setName('footer').setDescription('Footer text'))
      .addStringOption(o => o.setName('image').setDescription('Image URL'))
      .addStringOption(o => o.setName('thumbnail').setDescription('Thumbnail URL'))
      .addStringOption(o => o.setName('author').setDescription('Author name'))
      .addStringOption(o => o.setName('url').setDescription('URL for title')))
    .addSubcommand(s => s.setName('send').setDescription('Send an embed')
      .addStringOption(o => o.setName('name').setDescription('Embed name').setRequired(true).setAutocomplete(true))
      .addChannelOption(o => o.setName('channel').setDescription('Channel')))
    .addSubcommand(s => s.setName('delete').setDescription('Delete an embed')
      .addStringOption(o => o.setName('name').setDescription('Embed name').setRequired(true).setAutocomplete(true)))
    .addSubcommand(s => s.setName('list').setDescription('List all embeds'))
    .addSubcommand(s => s.setName('preview').setDescription('Preview an embed')
      .addStringOption(o => o.setName('name').setDescription('Embed name').setRequired(true).setAutocomplete(true)))
    .addSubcommand(s => s.setName('edit').setDescription('Edit an embed (interactive)')
      .addStringOption(o => o.setName('name').setDescription('Embed name').setRequired(true).setAutocomplete(true))),

  async autocomplete(interaction) {
    const guildId = interaction.guildId;
    if (!guildId) return;
    const focused = interaction.options.getFocused(true);
    const embeds = db.getEmbeds(guildId);
    const choices = Object.keys(embeds).filter(c => c.toLowerCase().includes(focused.value.toLowerCase())).slice(0, 25);
    await interaction.respond(choices.map(c => ({ name: c, value: c })));
  },

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'create') {
      const name = interaction.options.getString('name').toLowerCase().replace(/\s+/g, '-');
      const title = interaction.options.getString('title');
      const description = interaction.options.getString('description');
      const color = interaction.options.getString('color') || '#5865F2';
      const footer = interaction.options.getString('footer');
      const image = interaction.options.getString('image');
      const thumbnail = interaction.options.getString('thumbnail');
      const author = interaction.options.getString('author');
      const url = interaction.options.getString('url');

      const data = {
        title: title || null,
        description: description || null,
        color,
        footer: footer || null,
        image: image || null,
        thumbnail: thumbnail || null,
        author: author || null,
        url: url || null,
      };

      db.saveEmbed(guildId, name, data);
      const embed = buildEmbedFromData(data);

      const editButtons = EDIT_FIELDS.map(f => {
        return new ButtonBuilder()
          .setCustomId(`embed-edit:${name}:${f.id}`)
          .setLabel(f.label)
          .setStyle(ButtonStyle.Secondary);
      });

      const rows = [];
      for (let i = 0; i < editButtons.length; i += 4) {
        rows.push(new ActionRowBuilder().addComponents(editButtons.slice(i, i + 4)));
      }
      rows.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`embed-delete:${name}`).setLabel('🗑️ Delete').setStyle(ButtonStyle.Danger)
      ));

      await interaction.reply({ content: `✅ Embed **${name}** created!`, embeds: [embed], components: rows });
      return;
    }

    if (sub === 'send') {
      const name = interaction.options.getString('name').toLowerCase();
      const channel = interaction.options.getChannel('channel') || interaction.channel;
      const saved = db.getEmbed(guildId, name);
      if (!saved) return interaction.reply({ content: `❌ No embed named **${name}**.`, ephemeral: true });
      await channel.send({ embeds: [buildEmbedFromData(saved)] });
      return interaction.reply({ content: `✅ Sent embed **${name}** to ${channel}.`, ephemeral: true });
    }

    if (sub === 'delete') {
      const name = interaction.options.getString('name').toLowerCase();
      if (!db.getEmbed(guildId, name)) return interaction.reply({ content: `❌ No embed named **${name}**.`, ephemeral: true });
      db.deleteEmbed(guildId, name);
      return interaction.reply({ content: `✅ Embed **${name}** deleted.`, ephemeral: true });
    }

    if (sub === 'list') {
      const embeds = db.getEmbeds(guildId);
      const names = Object.keys(embeds);
      if (!names.length) return interaction.reply({ content: '📭 No embeds yet.', ephemeral: true });
      return interaction.reply({ embeds: [botEmbed().setTitle('📋 Saved Embeds').setDescription(names.map(n => `• \`${n}\``).join('\n'))], ephemeral: true });
    }

    if (sub === 'preview') {
      const name = interaction.options.getString('name').toLowerCase();
      const saved = db.getEmbed(guildId, name);
      if (!saved) return interaction.reply({ content: `❌ No embed named **${name}**.`, ephemeral: true });
      return interaction.reply({ content: `Preview of **${name}**:`, embeds: [buildEmbedFromData(saved)], ephemeral: true });
    }

    if (sub === 'edit') {
      const name = interaction.options.getString('name').toLowerCase();
      const saved = db.getEmbed(guildId, name);
      if (!saved) return interaction.reply({ content: `❌ No embed named **${name}**.`, ephemeral: true });

      const editButtons = EDIT_FIELDS.map(f => {
        return new ButtonBuilder()
          .setCustomId(`embed-edit:${name}:${f.id}`)
          .setLabel(f.label)
          .setStyle(ButtonStyle.Secondary);
      });

      const rows = [];
      for (let i = 0; i < editButtons.length; i += 4) {
        rows.push(new ActionRowBuilder().addComponents(editButtons.slice(i, i + 4)));
      }
      rows.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`embed-delete:${name}`).setLabel('🗑️ Delete').setStyle(ButtonStyle.Danger)
      ));

      return interaction.reply({ content: `Editing **${name}**:`, embeds: [buildEmbedFromData(saved)], components: rows, ephemeral: true });
    }
  },
};