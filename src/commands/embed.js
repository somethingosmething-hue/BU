const { SlashCommandBuilder, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const db = require('../database/db');
const { buildEmbedFromData, botEmbed } = require('../utils/parser');

const EDIT_FIELDS = [
  { id: 'title', label: 'Title', style: 'short', max: 256 },
  { id: 'description', label: 'Description', style: 'paragraph', max: 4096 },
  { id: 'color', label: 'Color (#hex)', style: 'short', max: 7, placeholder: '#5865F2' },
  { id: 'footer', label: 'Footer', style: 'short', max: 2048 },
  { id: 'image', label: 'Image URL', style: 'short', max: 2000 },
  { id: 'thumbnail', label: 'Thumbnail URL', style: 'short', max: 2000 },
  { id: 'author', label: 'Author name', style: 'short', max: 256 },
  { id: 'url', label: 'URL (for title)', style: 'short', max: 2000 },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Create and manage custom embeds')
    .setDefaultMemberPermissions(0x20)
    .addSubcommand(s => s.setName('create').setDescription('Create a new embed (opens modal)').addStringOption(o => o.setName('name').setDescription('Embed name').setRequired(true)))
    .addSubcommand(s => s.setName('send').setDescription('Send a saved embed to a channel')
      .addStringOption(o => o.setName('name').setDescription('Embed name').setRequired(true).setAutocomplete(true))
      .addChannelOption(o => o.setName('channel').setDescription('Channel to send to (defaults to current)')))
    .addSubcommand(s => s.setName('delete').setDescription('Delete a saved embed')
      .addStringOption(o => o.setName('name').setDescription('Embed name').setRequired(true).setAutocomplete(true)))
    .addSubcommand(s => s.setName('list').setDescription('List all saved embeds'))
    .addSubcommand(s => s.setName('preview').setDescription('Preview a saved embed')
      .addStringOption(o => o.setName('name').setDescription('Embed name').setRequired(true).setAutocomplete(true)))
    .addSubcommand(s => s.setName('edit').setDescription('Edit a saved embed (interactive)').addStringOption(o => o.setName('name').setDescription('Embed name').setRequired(true).setAutocomplete(true)))
    .addSubcommand(s => s.setName('quickedit').setDescription('Quick edit a field')
      .addStringOption(o => o.setName('name').setDescription('Embed name').setRequired(true).setAutocomplete(true))
      .addStringOption(o => o.setName('field').setDescription('Field').setRequired(true).addChoices(
        { name: 'title', value: 'title' },
        { name: 'description', value: 'description' },
        { name: 'color', value: 'color' },
        { name: 'footer', value: 'footer' },
        { name: 'image', value: 'image' },
        { name: 'thumbnail', value: 'thumbnail' },
        { name: 'author', value: 'author' },
        { name: 'url', value: 'url' },
      ))
      .addStringOption(o => o.setName('value').setDescription('New value').setRequired(true))),

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

      const modal = new ModalBuilder().setCustomId(`embed-create:${name}`).setTitle(`Create Embed: ${name}`);
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('title').setLabel('Title').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(256)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('description').setLabel('Description').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(4000)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('color').setLabel('Color (#hex)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(7).setPlaceholder('#5865F2')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('footer').setLabel('Footer').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(2048)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('image').setLabel('Image URL').setStyle(TextInputStyle.Short).setRequired(false)
        ),
      );
      await interaction.showModal(modal);

      try {
        const submitted = await interaction.awaitModalSubmit({ time: 120_000, filter: i => i.customId === `embed-create:${name}` && i.user.id === interaction.user.id });
        const data = {
          title: submitted.fields.getTextInputValue('title') || null,
          description: submitted.fields.getTextInputValue('description') || null,
          color: submitted.fields.getTextInputValue('color') || '#5865F2',
          footer: submitted.fields.getTextInputValue('footer') || null,
          image: submitted.fields.getTextInputValue('image') || null,
        };
        db.saveEmbed(guildId, name, data);
        const preview = buildEmbedFromData(data);
        await submitted.reply({ content: `✅ Embed **${name}** saved! Here's a preview:`, embeds: [preview] });
      } catch { /* modal timed out */ }
      return;
    }

    if (sub === 'send') {
      const name = interaction.options.getString('name').toLowerCase();
      const channel = interaction.options.getChannel('channel') || interaction.channel;
      const saved = db.getEmbed(guildId, name);
      if (!saved) return interaction.reply({ content: `❌ No embed named **${name}** found.`, ephemeral: true });
      const embed = buildEmbedFromData(saved);
      await channel.send({ embeds: [embed] });
      return interaction.reply({ content: `✅ Embed **${name}** sent to ${channel}.`, ephemeral: true });
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
      if (!names.length) return interaction.reply({ content: '📭 No saved embeds yet. Create one with `/embed create`.', ephemeral: true });
      return interaction.reply({
        embeds: [botEmbed().setTitle('📋 Saved Embeds').setDescription(names.map(n => `• \`${n}\``).join('\n'))],
        ephemeral: true,
      });
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
        const val = saved[f.id] || '(empty)';
        const label = `${f.label}: ${String(val).slice(0, 20)}${String(val).length > 20 ? '...' : ''}`;
        return new ButtonBuilder()
          .setCustomId(`embed-edit:${name}:${f.id}`)
          .setLabel(label)
          .setStyle(ButtonStyle.Secondary);
      });

      const rows = [];
      for (let i = 0; i < editButtons.length; i += 2) {
        rows.push(new ActionRowBuilder().addComponents(editButtons.slice(i, i + 2)));
      }

      rows.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`embed-delete:${name}`).setLabel('🗑️ Delete Embed').setStyle(ButtonStyle.Danger)
      ));

      return interaction.reply({
        content: `Editing **${name}** — current preview:`,
        embeds: [buildEmbedFromData(saved)],
        components: rows,
        ephemeral: true,
      });
    }

    if (sub === 'quickedit') {
      const name = interaction.options.getString('name').toLowerCase();
      const field = interaction.options.getString('field');
      const value = interaction.options.getString('value');
      const saved = db.getEmbed(guildId, name);
      if (!saved) return interaction.reply({ content: `❌ No embed named **${name}**.`, ephemeral: true });

      saved[field] = value || null;
      db.saveEmbed(guildId, name, saved);
      return interaction.reply({ content: `✅ Updated **${field}** on embed **${name}**.`, embeds: [buildEmbedFromData(saved)], ephemeral: true });
    }
  },
};