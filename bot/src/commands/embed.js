const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require('discord.js');
const db = require('../database/db');
const { buildEmbedFromData, botEmbed } = require('../utils/parser');

const EDIT_FIELDS = [
    { id: 'title',       label: 'Title',       max: 256,  style: 'short'    },
    { id: 'description', label: 'Description', max: 4096, style: 'paragraph' },
    { id: 'color',       label: 'Color (#hex)',max: 7,    style: 'short'    },
    { id: 'footer',      label: 'Footer',      max: 2048, style: 'short'    },
    { id: 'image',       label: 'Image URL',   max: 2000, style: 'short'    },
    { id: 'thumbnail',   label: 'Thumbnail',   max: 2000, style: 'short'    },
    { id: 'author',      label: 'Author',      max: 256,  style: 'short'    },
    { id: 'url',         label: 'URL',         max: 2000, style: 'short'    },
];

function buildEditRows(name, saved) {
    const editButtons = EDIT_FIELDS.map(f => {
        const val = saved?.[f.id];
        const display = val ? String(val).slice(0, 18) + (String(val).length > 18 ? '…' : '') : '∅';
        return new ButtonBuilder()
            .setCustomId(`embed-edit:${name}:${f.id}`)
            .setLabel(`${f.label}: ${display}`)
            .setStyle(ButtonStyle.Secondary);
    });

    const rows = [];
    for (let i = 0; i < editButtons.length; i += 4) {
        rows.push(new ActionRowBuilder().addComponents(editButtons.slice(i, i + 4)));
    }
    rows.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`embed-delete:${name}`)
            .setLabel('🗑️ Delete')
            .setStyle(ButtonStyle.Danger)
    ));
    return rows;
}

function validateEmbedData(data) {
    const hasContent = data.title || data.description || data.footer ||
                       data.image || data.thumbnail || data.author || data.url;
    if (!hasContent) {
        return '❌ Embed must have at least one field set (title, description, footer, image, thumbnail, author, or url).';
    }
    if (data.color && !/^#[0-9a-fA-F]{6}$/.test(data.color)) {
        return '❌ Color must be a valid hex code like `#5865F2`.';
    }
    return null;
}

module.exports = {
    permissions: ['ManageMessages'],

    data: new SlashCommandBuilder()
        .setName('embed')
        .setDescription('Create and manage embeds')
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
        .addSubcommand(s => s.setName('send').setDescription('Send an embed to a channel')
            .addStringOption(o => o.setName('name').setDescription('Embed name').setRequired(true).setAutocomplete(true))
            .addChannelOption(o => o.setName('channel').setDescription('Channel (defaults to current)')))
        .addSubcommand(s => s.setName('delete').setDescription('Delete a saved embed')
            .addStringOption(o => o.setName('name').setDescription('Embed name').setRequired(true).setAutocomplete(true)))
        .addSubcommand(s => s.setName('list').setDescription('List all saved embeds'))
        .addSubcommand(s => s.setName('preview').setDescription('Preview an embed')
            .addStringOption(o => o.setName('name').setDescription('Embed name').setRequired(true).setAutocomplete(true)))
        .addSubcommand(s => s.setName('edit').setDescription('Edit an embed interactively')
            .addStringOption(o => o.setName('name').setDescription('Embed name').setRequired(true).setAutocomplete(true)))
        .addSubcommand(s => s.setName('quickedit').setDescription('Quickly update a single field')
            .addStringOption(o => o.setName('name').setDescription('Embed name').setRequired(true).setAutocomplete(true))
            .addStringOption(o => o.setName('field').setDescription('Field to edit').setRequired(true)
                .addChoices(
                    { name: 'Title', value: 'title' },
                    { name: 'Description', value: 'description' },
                    { name: 'Color', value: 'color' },
                    { name: 'Footer', value: 'footer' },
                    { name: 'Image URL', value: 'image' },
                    { name: 'Thumbnail URL', value: 'thumbnail' },
                    { name: 'Author', value: 'author' },
                    { name: 'URL', value: 'url' },
                ))
            .addStringOption(o => o.setName('value').setDescription('New value').setRequired(true))),

    async autocomplete(interaction) {
        const guildId = interaction.guildId;
        if (!guildId) return;
        const focused = interaction.options.getFocused(true);
        const embeds = await db.getEmbeds(guildId);
        const choices = Object.keys(embeds)
            .filter(c => c.toLowerCase().includes(focused.value.toLowerCase()))
            .slice(0, 25);
        await interaction.respond(choices.map(c => ({ name: c, value: c }))).catch(() => {});
    },

    async execute(interaction, client) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guildId;

        // ── Create ────────────────────────────────────────────────────────────
        if (sub === 'create') {
            const name = interaction.options.getString('name').toLowerCase().replace(/\s+/g, '-');

            const data = {
                title:       interaction.options.getString('title')       || null,
                description: interaction.options.getString('description') || null,
                color:       interaction.options.getString('color')       || '#5865F2',
                footer:      interaction.options.getString('footer')      || null,
                image:       interaction.options.getString('image')       || null,
                thumbnail:   interaction.options.getString('thumbnail')   || null,
                author:      interaction.options.getString('author')      || null,
                url:         interaction.options.getString('url')         || null,
            };

            const validationError = validateEmbedData(data);
            if (validationError) return interaction.reply({ content: validationError, ephemeral: true });

            const existing = await db.getEmbed(guildId, name);
            if (existing) {
                return interaction.reply({ content: `❌ An embed named **${name}** already exists. Use \`/embed edit\` to modify it.`, ephemeral: true });
            }

            await db.saveEmbed(guildId, name, data);

            const embed = buildEmbedFromData(data);
            return interaction.reply({
                content: `✅ Embed **${name}** created!`,
                embeds: [embed],
                components: buildEditRows(name, data),
            });
        }

        // ── Send ──────────────────────────────────────────────────────────────
        if (sub === 'send') {
            const name = interaction.options.getString('name').toLowerCase();
            const channel = interaction.options.getChannel('channel') || interaction.channel;
            const saved = await db.getEmbed(guildId, name);
            if (!saved) return interaction.reply({ content: `❌ No embed named **${name}**.`, ephemeral: true });

            const validationError = validateEmbedData(saved);
            if (validationError) return interaction.reply({ content: `❌ ${validationError}`, ephemeral: true });

            await channel.send({ embeds: [buildEmbedFromData(saved)] });
            return interaction.reply({ content: `✅ Sent embed **${name}** to ${channel}.`, ephemeral: true });
        }

        // ── Delete ────────────────────────────────────────────────────────────
        if (sub === 'delete') {
            const name = interaction.options.getString('name').toLowerCase();
            const existing = await db.getEmbed(guildId, name);
            if (!existing) return interaction.reply({ content: `❌ No embed named **${name}**.`, ephemeral: true });
            await db.deleteEmbed(guildId, name);
            return interaction.reply({ content: `✅ Embed **${name}** deleted.`, ephemeral: true });
        }

        // ── List ──────────────────────────────────────────────────────────────
        if (sub === 'list') {
            const embeds = await db.getEmbeds(guildId);
            const names = Object.keys(embeds);
            if (!names.length) return interaction.reply({ content: '📭 No embeds saved yet.', ephemeral: true });
            return interaction.reply({
                embeds: [botEmbed().setTitle('📋 Saved Embeds').setDescription(names.map(n => `• \`${n}\``).join('\n'))],
                ephemeral: true,
            });
        }

        // ── Preview ───────────────────────────────────────────────────────────
        if (sub === 'preview') {
            const name = interaction.options.getString('name').toLowerCase();
            const saved = await db.getEmbed(guildId, name);
            if (!saved) return interaction.reply({ content: `❌ No embed named **${name}**.`, ephemeral: true });

            const validationError = validateEmbedData(saved);
            if (validationError) return interaction.reply({ content: `⚠️ ${validationError}`, ephemeral: true });

            return interaction.reply({ content: `Preview of **${name}**:`, embeds: [buildEmbedFromData(saved)], ephemeral: true });
        }

        // ── Edit ──────────────────────────────────────────────────────────────
        if (sub === 'edit') {
            const name = interaction.options.getString('name').toLowerCase();
            const saved = await db.getEmbed(guildId, name);
            if (!saved) return interaction.reply({ content: `❌ No embed named **${name}**.`, ephemeral: true });

            const embed = buildEmbedFromData(saved);

            await interaction.reply({
                content: `✏️ Editing **${name}** — click a button to edit that field:`,
                embeds: [embed],
                components: buildEditRows(name, saved),
            });
        }

        // ── Quick Edit ─────────────────────────────────────────────────────────
        if (sub === 'quickedit') {
            const name = interaction.options.getString('name').toLowerCase();
            const field = interaction.options.getString('field');
            const value = interaction.options.getString('value');

            const saved = await db.getEmbed(guildId, name);
            if (!saved) return interaction.reply({ content: `❌ No embed named **${name}**.`, ephemeral: true });

            saved[field] = value || null;
            await db.saveEmbed(guildId, name, saved);

            const embed = buildEmbedFromData(saved);

            return interaction.reply({
                content: `✅ Updated **${field}** for embed \`${name}\``,
                embeds: [embed],
                components: buildEditRows(name, saved),
            });
        }
    },
};
