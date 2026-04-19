const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const db = require('../database/db');
const { botEmbed } = require('../utils/parser');

const COLOR_CHOICES = [
  { name: 'blue', value: 'blue' },
  { name: 'green', value: 'green' },
  { name: 'grey', value: 'grey' },
  { name: 'red', value: 'red' },
];

const STYLE_MAP = {
  blue: ButtonStyle.Primary,
  green: ButtonStyle.Success,
  grey: ButtonStyle.Secondary,
  gray: ButtonStyle.Secondary,
  red: ButtonStyle.Danger,
};

module.exports = {
    permissions: ['ManageGuild'],
  data: new SlashCommandBuilder()
    .setName('button')
    .setDescription('Create button and select menu responders')

    .addSubcommand(s => s.setName('add').setDescription('Create a button responder')
      .addStringOption(o => o.setName('name').setDescription('Button name (ID)').setRequired(true))
      .addStringOption(o => o.setName('label').setDescription('Button label').setRequired(true))
      .addStringOption(o => o.setName('reply').setDescription('Reply (supports placeholders)').setRequired(true))
      .addStringOption(o => o.setName('color').setDescription('Button color').addChoices(...COLOR_CHOICES))
      .addStringOption(o => o.setName('emoji').setDescription('Button emoji'))
      .addIntegerOption(o => o.setName('cooldown').setDescription('Cooldown (seconds)').setMinValue(0))
      .addBooleanOption(o => o.setName('ephemeral').setDescription('Ephemeral reply? (default: true)')))
    .addSubcommand(s => s.setName('addselect').setDescription('Create a select menu responder')
      .addStringOption(o => o.setName('name').setDescription('Select menu name (ID)').setRequired(true))
      .addStringOption(o => o.setName('placeholder').setDescription('Placeholder text').setRequired(true))
      .addStringOption(o => o.setName('options').setDescription('Options: label|value|desc (comma separated)').setRequired(true))
      .addStringOption(o => o.setName('reply').setDescription('Reply (supports placeholders, use {value} for selected)').setRequired(true))
      .addIntegerOption(o => o.setName('cooldown').setDescription('Cooldown (seconds)').setMinValue(0)))
    .addSubcommand(s => s.setName('remove').setDescription('Delete a button/select responder')
      .addStringOption(o => o.setName('name').setDescription('Responder name').setRequired(true).setAutocomplete(true)))
    .addSubcommand(s => s.setName('list').setDescription('List all button/select responders'))
    .addSubcommand(s => s.setName('panel').setDescription('Send a panel with buttons/selects')
      .addStringOption(o => o.setName('components').setDescription('Names (comma separated)').setRequired(true))
      .addChannelOption(o => o.setName('channel').setDescription('Channel'))
      .addStringOption(o => o.setName('message').setDescription('Message content'))),

  async autocomplete(interaction) {
    const guildId = interaction.guildId;
    if (!guildId) return;
    const focused = interaction.options.getFocused(true);
    const btns = db.getButtonResponders(guildId);
    const choices = Object.keys(btns).filter(c => c.toLowerCase().includes(focused.value.toLowerCase())).slice(0, 25);
    await interaction.respond(choices.map(c => ({ name: c, value: c })));
  },

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'add') {
      const name = interaction.options.getString('name').toLowerCase().replace(/\s+/g, '-');
      const label = interaction.options.getString('label');
      const reply = interaction.options.getString('reply');
      const color = interaction.options.getString('color') || 'blue';
      const emoji = interaction.options.getString('emoji') || null;
      const cooldown = interaction.options.getInteger('cooldown') ?? 0;
      const ephemeral = interaction.options.getBoolean('ephemeral') ?? true;

      db.saveButtonResponder(guildId, name, { type: 'button', label, reply, color, emoji, cooldown: cooldown || null, ephemeral });

      const preview = new ButtonBuilder()
        .setCustomId(`br:${name}`)
        .setLabel(label)
        .setStyle(STYLE_MAP[color] || ButtonStyle.Primary);
      if (emoji) preview.setEmoji(emoji);

      return interaction.reply({
        embeds: [botEmbed('#77dd77').setTitle('✅ Button Created').addFields(
          { name: 'Name', value: name, inline: true },
          { name: 'Color', value: color, inline: true },
          { name: 'Cooldown', value: cooldown ? `${cooldown}s` : 'None', inline: true },
          { name: 'Reply', value: reply.slice(0, 1024) },
        )],
        components: [new ActionRowBuilder().addComponents(preview)],
      });
    }

    if (sub === 'addselect') {
      const name = interaction.options.getString('name').toLowerCase().replace(/\s+/g, '-');
      const placeholder = interaction.options.getString('placeholder');
      const optionsStr = interaction.options.getString('options');
      const reply = interaction.options.getString('reply');
      const cooldown = interaction.options.getInteger('cooldown') ?? 0;

      const selectOptions = optionsStr.split(',').map(opt => {
        const parts = opt.split('|').map(s => s.trim());
        return {
          label: parts[0] || 'Option',
          value: parts[1] || parts[0].toLowerCase().replace(/\s+/g, '-'),
          description: parts[2] || null,
        };
      });

      db.saveButtonResponder(guildId, name, {
        type: 'select',
        placeholder,
        selectOptions,
        reply,
        cooldown: cooldown || null,
      });

      return interaction.reply({
        embeds: [botEmbed('#77dd77').setTitle('✅ Select Menu Created').addFields(
          { name: 'Name', value: name, inline: true },
          { name: 'Options', value: selectOptions.map(o => o.label).join(', '), inline: true },
          { name: 'Cooldown', value: cooldown ? `${cooldown}s` : 'None', inline: true },
        )],
      });
    }

    if (sub === 'remove') {
      const name = interaction.options.getString('name').toLowerCase();
      if (!db.getButtonResponder(guildId, name)) {
        return interaction.reply({ content: `❌ No responder named **${name}**.`, ephemeral: true });
      }
      db.deleteButtonResponder(guildId, name);
      return interaction.reply({ content: `✅ Responder **${name}** deleted.` });
    }

    if (sub === 'list') {
      const all = db.getButtonResponders(guildId);
      const keys = Object.keys(all);
      if (!keys.length) return interaction.reply({ content: '📭 No responders yet.', ephemeral: true });

      const lines = keys.map(k => {
        const b = all[k];
        const type = b.type === 'select' ? '📋' : '🔘';
        return `${type} \`${k}\` — ${b.label || b.placeholder} [${b.type || 'button'}]`;
      });

      return interaction.reply({
        embeds: [botEmbed().setTitle(`🔘 Responders (${keys.length})`).setDescription(lines.join('\n'))],
        ephemeral: true,
      });
    }

    if (sub === 'panel') {
      const names = interaction.options.getString('components').split(',').map(s => s.trim().toLowerCase());
      const channel = interaction.options.getChannel('channel') || interaction.channel;
      const message = interaction.options.getString('message') || null;

      const { StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder } = require('discord.js');
      const rows = [];
      const buttons = [];
      const selects = [];

      for (const name of names) {
        const data = db.getButtonResponder(guildId, name);
        if (!data) continue;

        if (data.type === 'select') {
          const menu = new StringSelectMenuBuilder()
            .setCustomId(`sel:${name}`)
            .setPlaceholder(data.placeholder || 'Select');
          for (const opt of data.selectOptions || []) {
            menu.addOptions(new StringSelectMenuOptionBuilder()
              .setLabel(opt.label)
              .setValue(opt.value)
              .setDescription(opt.description || null));
          }
          selects.push(menu);
        } else {
          const btn = new ButtonBuilder()
            .setCustomId(`br:${name}`)
            .setLabel(data.label)
            .setStyle(STYLE_MAP[data.color] || ButtonStyle.Primary);
          if (data.emoji) btn.setEmoji(data.emoji);
          buttons.push(btn);
        }
      }

      if (buttons.length) {
        for (let i = 0; i < buttons.length; i += 5) {
          rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
        }
      }

      if (selects.length) {
        for (const sel of selects) {
          rows.push(new ActionRowBuilder().addComponents(sel));
        }
      }

      if (!rows.length) return interaction.reply({ content: '❌ No valid components.', ephemeral: true });

      const payload = { components: rows };
      if (message) payload.content = message;

      await channel.send(payload);
      return interaction.reply({ content: `✅ Panel sent to ${channel}.`, ephemeral: true });
    }
  },
};
