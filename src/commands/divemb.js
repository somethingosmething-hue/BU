const { SlashCommandBuilder, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const db = require('../database/db');
const { buildDivembFromData, botEmbed } = require('../utils/parser');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('divemb')
    .setDescription('Create and manage message components (V2 embeds)')
    .setDefaultMemberPermissions(0x20)
    .addSubcommand(s => s.setName('create').setDescription('Create a new divemb (opens modal)').addStringOption(o => o.setName('name').setDescription('Divemb name').setRequired(true)))
    .addSubcommand(s => s.setName('send').setDescription('Send a saved divemb to a channel')
      .addStringOption(o => o.setName('name').setDescription('Divemb name').setRequired(true).setAutocomplete(true))
      .addChannelOption(o => o.setName('channel').setDescription('Channel to send to (defaults to current)')))
    .addSubcommand(s => s.setName('delete').setDescription('Delete a saved divemb')
      .addStringOption(o => o.setName('name').setDescription('Divemb name').setRequired(true).setAutocomplete(true)))
    .addSubcommand(s => s.setName('list').setDescription('List all saved divembs'))
    .addSubcommand(s => s.setName('preview').setDescription('Preview a saved divemb')
      .addStringOption(o => o.setName('name').setDescription('Divemb name').setRequired(true).setAutocomplete(true)))
    .addSubcommand(s => s.setName('edit').setDescription('Edit a saved divemb')
      .addStringOption(o => o.setName('name').setDescription('Divemb name').setRequired(true).setAutocomplete(true))
      .addStringOption(o => o.setName('field').setDescription('Field to edit').setRequired(true)
        .addChoices(
          { name: 'title', value: 'title' },
          { name: 'description', value: 'description' },
          { name: 'color', value: 'color' },
          { name: 'footer', value: 'footer' },
          { name: 'image', value: 'image' },
          { name: 'thumbnail', value: 'thumbnail' },
          { name: 'author', value: 'author' },
          { name: 'url', value: 'url' },
          { name: 'timestamp', value: 'timestamp' },
          { name: 'add_field', value: 'add_field' },
          { name: 'remove_field', value: 'remove_field' },
        ))
      .addStringOption(o => o.setName('value').setDescription('New value (for add_field: name|value|inline)').setRequired(false)))
    .addSubcommand(s => s.setName('view').setDescription('View divemb details')
      .addStringOption(o => o.setName('name').setDescription('Divemb name').setRequired(true).setAutocomplete(true))),

  async autocomplete(interaction) {
    const guildId = interaction.guildId;
    const focused = interaction.options.getFocused(true);
    const divembs = db.getDivembs(guildId);
    const choices = Object.keys(divembs).slice(0, 25);
    const filtered = choices.filter(c => c.toLowerCase().includes(focused.value.toLowerCase()));
    await interaction.respond(filtered.map(c => ({ name: c, value: c })));
  },

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'create') {
      const name = interaction.options.getString('name').toLowerCase().replace(/\s+/g, '-');

      const modal = new ModalBuilder().setCustomId(`divemb-create:${name}`).setTitle(`Create Divemb: ${name}`);
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('title').setLabel('Title').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(256)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('description').setLabel('Description').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(4000)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('color').setLabel('Color (hex, e.g. #5865F2)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(7).setPlaceholder('#5865F2')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('footer').setLabel('Footer text').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(2048)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('image').setLabel('Image URL').setStyle(TextInputStyle.Short).setRequired(false)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('thumbnail').setLabel('Thumbnail URL').setStyle(TextInputStyle.Short).setRequired(false)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('author').setLabel('Author name').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(256)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('url').setLabel('URL (for title)').setStyle(TextInputStyle.Short).setRequired(false)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('timestamp').setLabel('Add timestamp? (yes/no)').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('yes')
        ),
      );
      await interaction.showModal(modal);

      try {
        const submitted = await interaction.awaitModalSubmit({ time: 120_000, filter: i => i.customId === `divemb-create:${name}` && i.user.id === interaction.user.id });
        const data = {
          title: submitted.fields.getTextInputValue('title') || null,
          description: submitted.fields.getTextInputValue('description') || null,
          color: submitted.fields.getTextInputValue('color') || '#5865F2',
          footer: submitted.fields.getTextInputValue('footer') || null,
          image: submitted.fields.getTextInputValue('image') || null,
          thumbnail: submitted.fields.getTextInputValue('thumbnail') || null,
          author: submitted.fields.getTextInputValue('author') || null,
          url: submitted.fields.getTextInputValue('url') || null,
          timestamp: submitted.fields.getTextInputValue('timestamp')?.toLowerCase() === 'yes',
          fields: [],
        };
        db.saveDivemb(guildId, name, data);
        const preview = buildDivembFromData(data);
        await submitted.reply({ content: `✅ Divemb **${name}** saved! Here's a preview:`, embeds: [preview] });
      } catch { /* modal timed out */ }
      return;
    }

    if (sub === 'send') {
      const name = interaction.options.getString('name').toLowerCase();
      const channel = interaction.options.getChannel('channel') || interaction.channel;
      const saved = db.getDivemb(guildId, name);
      if (!saved) return interaction.reply({ content: `❌ No divemb named **${name}** found.`, ephemeral: true });
      const embed = buildDivembFromData(saved);
      await channel.send({ embeds: [embed] });
      return interaction.reply({ content: `✅ Divemb **${name}** sent to ${channel}.`, ephemeral: true });
    }

    if (sub === 'delete') {
      const name = interaction.options.getString('name').toLowerCase();
      if (!db.getDivemb(guildId, name)) return interaction.reply({ content: `❌ No divemb named **${name}**.`, ephemeral: true });
      db.deleteDivemb(guildId, name);
      return interaction.reply({ content: `✅ Divemb **${name}** deleted.`, ephemeral: true });
    }

    if (sub === 'list') {
      const divembs = db.getDivembs(guildId);
      const names = Object.keys(divembs);
      if (!names.length) return interaction.reply({ content: '📭 No saved divembs yet. Create one with `/divemb create`.', ephemeral: true });
      return interaction.reply({
        embeds: [botEmbed().setTitle('📋 Saved Divembs').setDescription(names.map(n => `• \`${n}\``).join('\n'))],
        ephemeral: true,
      });
    }

    if (sub === 'preview') {
      const name = interaction.options.getString('name').toLowerCase();
      const saved = db.getDivemb(guildId, name);
      if (!saved) return interaction.reply({ content: `❌ No divemb named **${name}**.`, ephemeral: true });
      return interaction.reply({ content: `Preview of **${name}**:`, embeds: [buildDivembFromData(saved)], ephemeral: true });
    }

    if (sub === 'view') {
      const name = interaction.options.getString('name').toLowerCase();
      const saved = db.getDivemb(guildId, name);
      if (!saved) return interaction.reply({ content: `❌ No divemb named **${name}**.`, ephemeral: true });

      const fields = [];
      if (saved.title) fields.push({ name: 'Title', value: saved.title, inline: true });
      if (saved.description) fields.push({ name: 'Description', value: saved.description.length > 500 ? saved.description.slice(0, 497) + '...' : saved.description, inline: false });
      if (saved.color) fields.push({ name: 'Color', value: saved.color, inline: true });
      if (saved.footer) fields.push({ name: 'Footer', value: saved.footer, inline: true });
      if (saved.author) fields.push({ name: 'Author', value: saved.author, inline: true });
      if (saved.image) fields.push({ name: 'Image', value: `[Link](${saved.image})`, inline: true });
      if (saved.thumbnail) fields.push({ name: 'Thumbnail', value: `[Link](${saved.thumbnail})`, inline: true });
      if (saved.url) fields.push({ name: 'URL', value: saved.url, inline: true });
      fields.push({ name: 'Timestamp', value: saved.timestamp ? 'Yes' : 'No', inline: true });
      if (saved.fields?.length) {
        for (const f of saved.fields) {
          fields.push({ name: `Field: ${f.name}`, value: f.value, inline: f.inline || false });
        }
      }

      return interaction.reply({
        embeds: [botEmbed().setTitle(`🔍 Divemb: ${name}`).addFields(fields)],
        ephemeral: true,
      });
    }

    if (sub === 'edit') {
      const name = interaction.options.getString('name').toLowerCase();
      const field = interaction.options.getString('field');
      const value = interaction.options.getString('value');
      const saved = db.getDivemb(guildId, name);
      if (!saved) return interaction.reply({ content: `❌ No divemb named **${name}**.`, ephemeral: true });

      if (field === 'add_field') {
        if (!value) return interaction.reply({ content: '❌ Please provide value in format: name|value|inline', ephemeral: true });
        const parts = value.split('|').map(s => s.trim());
        const newField = { name: parts[0] || 'Field', value: parts[1] || 'Value', inline: parts[2]?.toLowerCase() === 'true' || parts[2]?.toLowerCase() === 'yes' };
        saved.fields = saved.fields || [];
        saved.fields.push(newField);
        db.saveDivemb(guildId, name, saved);
        return interaction.reply({ content: `✅ Added field to **${name}**.`, embeds: [buildDivembFromData(saved)], ephemeral: true });
      }

      if (field === 'remove_field') {
        const idx = parseInt(value) - 1;
        if (isNaN(idx) || !saved.fields || idx < 0 || idx >= saved.fields.length) {
          return interaction.reply({ content: '❌ Invalid field index. Use `/divemb view` to see field indices.', ephemeral: true });
        }
        saved.fields.splice(idx, 1);
        db.saveDivemb(guildId, name, saved);
        return interaction.reply({ content: `✅ Removed field ${idx + 1} from **${name}**.`, embeds: [buildDivembFromData(saved)], ephemeral: true });
      }

      saved[field] = value || null;
      if (field === 'timestamp') {
        saved[field] = value?.toLowerCase() === 'yes' || value?.toLowerCase() === 'true';
      }
      db.saveDivemb(guildId, name, saved);
      return interaction.reply({ content: `✅ Updated **${field}** on divemb **${name}**.`, embeds: [buildDivembFromData(saved)], ephemeral: true });
    }
  },
};