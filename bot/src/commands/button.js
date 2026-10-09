const { SlashCommandBuilder, ActionRowBuilder, ChannelType } = require('discord.js');
const db = require('../database/db');
const { botEmbed } = require('../utils/parser');
const { normalizeButtonName, buildButtonComponent, buildRowsFromNames, STYLE_MAP } = require('../utils/buttons');

function ephemeralLine(data) {
  return data.ephemeral ? 'Yes 👁️' : 'No';
}

function buttonInfoFields(name, data) {
  const fields = [
    { name: 'Name', value: name, inline: true },
    { name: 'Ephemeral', value: ephemeralLine(data), inline: true },
    { name: 'Cooldown', value: data.cooldown ? `${data.cooldown}s` : 'None', inline: true },
  ];
  if (data.type === 'select') {
    fields.push({ name: 'Placeholder', value: data.placeholder || 'Select', inline: true });
    fields.push({
      name: 'Options',
      value: (data.selectOptions || []).map(o => o.label).join(', ').slice(0, 1024) || 'None',
    });
  } else {
    fields.push(
      { name: 'Label', value: data.label || name, inline: true },
      { name: 'Color', value: data.color || 'blue', inline: true },
      { name: 'Emoji', value: data.emoji || 'None', inline: true },
    );
  }
  fields.push({ name: 'Reply', value: String(data.reply || '').slice(0, 1024) || 'None' });
  return fields;
}

function parseOptionsString(optionsStr) {
  return String(optionsStr || '')
    .split(',')
    .map(opt => {
      const parts = opt.split('|').map(s => s.trim());
      return {
        label: (parts[0] || 'Option').slice(0, 100),
        value: (parts[1] || parts[0] || 'option').toLowerCase().replace(/\s+/g, '-').slice(0, 100),
        description: (parts[2] || null)?.slice(0, 100) || null,
      };
    })
    .filter(o => o.label);
}

module.exports = {
    permissions: ['ManageGuild'],
  data: new SlashCommandBuilder()
    .setName('button')
    .setDescription('Create button and select menu responders')

    .addSubcommand(s => s.setName('add').setDescription('Create a button responder')
      .addStringOption(o => o.setName('name').setDescription('Button name (ID)').setRequired(true))
      .addStringOption(o => o.setName('label').setDescription('Button label').setRequired(true))
      .addStringOption(o => o.setName('reply').setDescription('Reply (supports placeholders, {ephemeral} for a private reply)').setRequired(true))
      .addStringOption(o => o.setName('color').setDescription('Button color').addChoices(
        { name: 'blue', value: 'blue' },
        { name: 'green', value: 'green' },
        { name: 'grey', value: 'grey' },
        { name: 'red', value: 'red' },
      ))
      .addStringOption(o => o.setName('emoji').setDescription('Button emoji'))
      .addIntegerOption(o => o.setName('cooldown').setDescription('Cooldown (seconds)').setMinValue(0))
      .addBooleanOption(o => o.setName('ephemeral').setDescription('Reply only visible to the clicker?')))
    .addSubcommand(s => s.setName('addselect').setDescription('Create a select menu responder')
      .addStringOption(o => o.setName('name').setDescription('Select menu name (ID)').setRequired(true))
      .addStringOption(o => o.setName('placeholder').setDescription('Placeholder text').setRequired(true))
      .addStringOption(o => o.setName('options').setDescription('Options: label|value|desc (comma separated)').setRequired(true))
      .addStringOption(o => o.setName('reply').setDescription('Reply (supports placeholders, use {value} for selected, {ephemeral} for a private reply)').setRequired(true))
      .addIntegerOption(o => o.setName('cooldown').setDescription('Cooldown (seconds)').setMinValue(0))
      .addBooleanOption(o => o.setName('ephemeral').setDescription('Reply only visible to the clicker?')))
    .addSubcommand(s => s.setName('edit').setDescription('Edit a button/select responder')
      .addStringOption(o => o.setName('name').setDescription('Responder name').setRequired(true).setAutocomplete(true))
      .addStringOption(o => o.setName('reply').setDescription('New reply (supports placeholders)').setRequired(false))
      .addStringOption(o => o.setName('label').setDescription('New button label (buttons only)').setRequired(false))
      .addStringOption(o => o.setName('color').setDescription('New button color (buttons only)').addChoices(
        { name: 'blue', value: 'blue' },
        { name: 'green', value: 'green' },
        { name: 'grey', value: 'grey' },
        { name: 'red', value: 'red' },
      ).setRequired(false))
      .addStringOption(o => o.setName('emoji').setDescription('New button emoji (buttons only, blank to clear)').setRequired(false))
      .addStringOption(o => o.setName('placeholder').setDescription('New placeholder (selects only)').setRequired(false))
      .addStringOption(o => o.setName('options').setDescription('New options: label|value|desc (selects only)').setRequired(false))
      .addIntegerOption(o => o.setName('cooldown').setDescription('New cooldown in seconds (0 to clear)').setMinValue(0).setRequired(false))
      .addBooleanOption(o => o.setName('ephemeral').setDescription('Reply only visible to the clicker?').setRequired(false)))
    .addSubcommand(s => s.setName('remove').setDescription('Delete a button/select responder')
      .addStringOption(o => o.setName('name').setDescription('Responder name').setRequired(true).setAutocomplete(true)))
    .addSubcommand(s => s.setName('list').setDescription('List all button/select responders'))
    .addSubcommand(s => s.setName('panel').setDescription('Send a panel with buttons/selects')
      .addStringOption(o => o.setName('components').setDescription('Names (comma separated)').setRequired(true))
      .addChannelOption(o => o.setName('channel').setDescription('Channel').addChannelTypes(ChannelType.GuildText))
      .addStringOption(o => o.setName('message').setDescription('Message content'))),

  async autocomplete(interaction) {
    const guildId = interaction.guildId;
    if (!guildId) return;
    const focused = interaction.options.getFocused(true);
    const btns = await db.getButtonResponders(guildId);
    const choices = Object.keys(btns).filter(c => c.toLowerCase().includes(focused.value.toLowerCase())).slice(0, 25);
    await interaction.respond(choices.map(c => ({ name: c, value: c }))).catch(() => {});
  },

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'add') {
      const name = normalizeButtonName(interaction.options.getString('name'));
      const label = interaction.options.getString('label');
      const reply = interaction.options.getString('reply');
      const color = interaction.options.getString('color') || 'blue';
      const emoji = interaction.options.getString('emoji') || null;
      const cooldown = interaction.options.getInteger('cooldown') ?? 0;
      const ephemeral = interaction.options.getBoolean('ephemeral') || false;
      if (!name) return interaction.reply({ content: '❌ Invalid button name.' });
      const data = { type: 'button', label, reply, color, emoji, cooldown: cooldown || null, ephemeral };
      await db.saveButtonResponder(guildId, name, data);

      let preview;
      try {
        preview = buildButtonComponent(data, name);
      } catch {
        preview = null;
      }

      const payload = {
        embeds: [botEmbed('#77dd77').setTitle('✅ Button Created').addFields(buttonInfoFields(name, data))],
      };
      if (preview) payload.components = [new ActionRowBuilder().addComponents(preview)];
      return interaction.reply(payload);
    }

    if (sub === 'addselect') {
      const name = normalizeButtonName(interaction.options.getString('name'));
      const placeholder = interaction.options.getString('placeholder');
      const optionsStr = interaction.options.getString('options');
      const reply = interaction.options.getString('reply');
      const cooldown = interaction.options.getInteger('cooldown') ?? 0;
      const ephemeral = interaction.options.getBoolean('ephemeral') || false;
      if (!name) return interaction.reply({ content: '❌ Invalid select menu name.' });

      const selectOptions = parseOptionsString(optionsStr);
      if (!selectOptions.length) return interaction.reply({ content: '❌ Provide at least one option: `label|value|desc`.' });
      if (selectOptions.length > 25) return interaction.reply({ content: '❌ Maximum 25 options allowed.' });

      const data = { type: 'select', placeholder, selectOptions, reply, cooldown: cooldown || null, ephemeral };
      await db.saveButtonResponder(guildId, name, data);

      return interaction.reply({
        embeds: [botEmbed('#77dd77').setTitle('✅ Select Menu Created').addFields(buttonInfoFields(name, data))],
      });
    }

    if (sub === 'edit') {
      const name = normalizeButtonName(interaction.options.getString('name'));
      const existing = await db.getButtonResponder(guildId, name);
      if (!existing) {
        return interaction.reply({ content: `❌ No responder named **${name}**.` });
      }
      const updated = { ...existing };
      const reply = interaction.options.getString('reply');
      const cooldown = interaction.options.getInteger('cooldown');
      const ephemeral = interaction.options.getBoolean('ephemeral');
      if (reply !== null) updated.reply = reply;
      if (cooldown !== null) updated.cooldown = cooldown || null;
      if (ephemeral !== null) updated.ephemeral = ephemeral;

      if (existing.type === 'select') {
        const placeholder = interaction.options.getString('placeholder');
        const optionsStr = interaction.options.getString('options');
        if (placeholder !== null) updated.placeholder = placeholder;
        if (optionsStr !== null) {
          const selectOptions = parseOptionsString(optionsStr);
          if (!selectOptions.length) return interaction.reply({ content: '❌ Provide at least one option: `label|value|desc`.' });
          if (selectOptions.length > 25) return interaction.reply({ content: '❌ Maximum 25 options allowed.' });
          updated.selectOptions = selectOptions;
        }
      } else {
        const label = interaction.options.getString('label');
        const color = interaction.options.getString('color');
        const emoji = interaction.options.getString('emoji');
        if (label !== null) updated.label = label;
        if (color !== null) updated.color = color;
        if (emoji !== null) updated.emoji = emoji || null;
      }

      await db.saveButtonResponder(guildId, name, updated);
      return interaction.reply({
        embeds: [botEmbed('#77dd77').setTitle('✅ Responder Updated').addFields(buttonInfoFields(name, updated))],
      });
    }

    if (sub === 'remove') {
      const name = normalizeButtonName(interaction.options.getString('name'));
      const existing = await db.getButtonResponder(guildId, name);
      if (!existing) {
        return interaction.reply({ content: `❌ No responder named **${name}**.` });
      }
      await db.deleteButtonResponder(guildId, name);
      return interaction.reply({ content: `✅ Responder **${name}** deleted.` });
    }

    if (sub === 'list') {
      const all = await db.getButtonResponders(guildId);
      const keys = Object.keys(all);
      if (!keys.length) return interaction.reply({ content: '📭 No responders yet.' });

      const lines = keys.map(k => {
        const b = all[k];
        const type = b.type === 'select' ? '📋' : '🔘';
        const eph = b.ephemeral ? ' 👁️' : '';
        return `${type} \`${k}\` — ${b.label || b.placeholder} [${b.type || 'button'}]${eph}`;
      });

      return interaction.reply({
        embeds: [botEmbed().setTitle(`🔘 Responders (${keys.length})`).setDescription(lines.join('\n'))],

      });
    }

    if (sub === 'panel') {
      const names = interaction.options.getString('components').split(',').map(s => s.trim()).filter(Boolean);
      const channel = interaction.options.getChannel('channel') || interaction.channel;
      const message = interaction.options.getString('message') || null;

      if (!channel || typeof channel.send !== 'function') {
        return interaction.reply({ content: '❌ That channel cannot receive messages.' });
      }

      const rows = await buildRowsFromNames(guildId, names);

      if (!rows.length) return interaction.reply({ content: '❌ No valid components.' });

      const payload = { components: rows };
      if (message) payload.content = message;

      try {
        await channel.send(payload);
      } catch (e) {
        return interaction.reply({ content: `❌ Failed to send panel: ${e.message}` });
      }
      return interaction.reply({ content: `✅ Panel sent to ${channel}.` });
    }
  },
};
