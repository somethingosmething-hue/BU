const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    SectionBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    TextDisplayBuilder,
    MessageFlags,
} = require('discord.js');
const db = require('../database/db');
const { buildEmbedFromData, botEmbed } = require('../utils/parser');

const EDIT_FIELDS = [
    { id: 'title',       label: 'Title'       },
    { id: 'description', label: 'Description' },
    { id: 'color',       label: 'Color'       },
    { id: 'footer',      label: 'Footer'      },
    { id: 'image',       label: 'Image'       },
    { id: 'thumbnail',   label: 'Thumbnail'   },
    { id: 'author',      label: 'Author'      },
    { id: 'url',         label: 'URL'         },
];

/** Build the edit button rows for an embed by name */
function buildEditRows(name) {
    const editButtons = EDIT_FIELDS.map(f =>
        new ButtonBuilder()
            .setCustomId(`embed-edit:${name}:${f.id}`)
            .setLabel(f.label)
            .setStyle(ButtonStyle.Secondary)
    );

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

/**
 * Validate that an embed data object has at least one visible field.
 * Discord requires embeds to have content — an all-null embed is rejected.
 */
function validateEmbedData(data) {
    const hasContent = data.title || data.description || data.footer ||
                       data.image || data.thumbnail || data.author || data.url;
    if (!hasContent) {
        return '❌ Embed must have at least one field set (title, description, footer, image, thumbnail, author, or url).';
    }
    if (data.color && !/^#[0-9a-fA-F]{6}$/.test(data.color)) {
        return '❌ Color must be a valid hex code like `#5865F2`.';
    }
    return null; // valid
}

/** Try to use Component V2 separators; falls back gracefully if unavailable */
function tryBuildV2Components(name, saved) {
    try {
        const container = new ContainerBuilder();

        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`### Embed: \`${name}\``)
        );
        container.addSeparatorComponents(
            new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
        );

        const editButtons = EDIT_FIELDS.map(f =>
            new ButtonBuilder()
                .setCustomId(`embed-edit:${name}:${f.id}`)
                .setLabel(f.label)
                .setStyle(ButtonStyle.Secondary)
        );
        for (let i = 0; i < editButtons.length; i += 4) {
            container.addActionRowComponents(
                new ActionRowBuilder().addComponents(editButtons.slice(i, i + 4))
            );
        }

        container.addSeparatorComponents(
            new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
        );
        container.addActionRowComponents(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`embed-delete:${name}`)
                    .setLabel('🗑️ Delete')
                    .setStyle(ButtonStyle.Danger)
            )
        );

        return { components: [container], flags: MessageFlags.IsComponentsV2 };
    } catch {
        // discord.js version doesn't support Component V2 builders — use classic layout
        return null;
    }
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
        .addSubcommand(s => s.setName('send').setDescription('Send an embed')
            .addStringOption(o => o.setName('name').setDescription('Embed name').setRequired(true).setAutocomplete(true))
            .addChannelOption(o => o.setName('channel').setDescription('Channel')))
        .addSubcommand(s => s.setName('delete').setDescription('Delete a saved embed')
            .addStringOption(o => o.setName('name').setDescription('Embed name').setRequired(true).setAutocomplete(true)))
        .addSubcommand(s => s.setName('list').setDescription('List all saved embeds'))
        .addSubcommand(s => s.setName('preview').setDescription('Preview an embed')
            .addStringOption(o => o.setName('name').setDescription('Embed name').setRequired(true).setAutocomplete(true)))
        .addSubcommand(s => s.setName('edit').setDescription('Edit an embed interactively')
            .addStringOption(o => o.setName('name').setDescription('Embed name').setRequired(true).setAutocomplete(true))),

    async autocomplete(interaction) {
        const guildId = interaction.guildId;
        if (!guildId) return;
        const focused = interaction.options.getFocused(true);
        const embeds = db.getEmbeds(guildId);
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

            if (db.getEmbed(guildId, name)) {
                return interaction.reply({ content: `❌ An embed named **${name}** already exists. Use \`/embed edit\` to modify it.`, ephemeral: true });
            }

            db.saveEmbed(guildId, name, data);

            const v2 = tryBuildV2Components(name, data);
            if (v2) {
                return interaction.reply({
                    content: `✅ Embed **${name}** created!`,
                    embeds: [buildEmbedFromData(data)],
                    ...v2,
                });
            }

            return interaction.reply({
                content: `✅ Embed **${name}** created!`,
                embeds: [buildEmbedFromData(data)],
                components: buildEditRows(name),
            });
        }

        // ── Send ──────────────────────────────────────────────────────────────
        if (sub === 'send') {
            const name = interaction.options.getString('name').toLowerCase();
            const channel = interaction.options.getChannel('channel') || interaction.channel;
            const saved = db.getEmbed(guildId, name);
            if (!saved) return interaction.reply({ content: `❌ No embed named **${name}**.`, ephemeral: true });

            const validationError = validateEmbedData(saved);
            if (validationError) return interaction.reply({ content: `❌ This embed has invalid data and cannot be sent: ${validationError}`, ephemeral: true });

            await channel.send({ embeds: [buildEmbedFromData(saved)] });
            return interaction.reply({ content: `✅ Sent embed **${name}** to ${channel}.`, ephemeral: true });
        }

        // ── Delete ────────────────────────────────────────────────────────────
        if (sub === 'delete') {
            const name = interaction.options.getString('name').toLowerCase();
            if (!db.getEmbed(guildId, name)) return interaction.reply({ content: `❌ No embed named **${name}**.`, ephemeral: true });
            db.deleteEmbed(guildId, name);
            return interaction.reply({ content: `✅ Embed **${name}** deleted.`, ephemeral: true });
        }

        // ── List ──────────────────────────────────────────────────────────────
        if (sub === 'list') {
            const embeds = db.getEmbeds(guildId);
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
            const saved = db.getEmbed(guildId, name);
            if (!saved) return interaction.reply({ content: `❌ No embed named **${name}**.`, ephemeral: true });

            const validationError = validateEmbedData(saved);
            if (validationError) return interaction.reply({ content: `⚠️ This embed has issues: ${validationError}`, ephemeral: true });

            return interaction.reply({ content: `Preview of **${name}**:`, embeds: [buildEmbedFromData(saved)], ephemeral: true });
        }

        // ── Edit ──────────────────────────────────────────────────────────────
        if (sub === 'edit') {
            const name = interaction.options.getString('name').toLowerCase();
            const saved = db.getEmbed(guildId, name);
            if (!saved) return interaction.reply({ content: `❌ No embed named **${name}**.`, ephemeral: true });

            const embedContent = validateEmbedData(saved) ? [] : [buildEmbedFromData(saved)];

            const v2 = tryBuildV2Components(name, saved);
            if (v2) {
                return interaction.reply({
                    content: `Editing **${name}**:`,
                    embeds: embedContent,
                    ephemeral: true,
                    ...v2,
                });
            }

            return interaction.reply({
                content: `Editing **${name}**:`,
                embeds: embedContent,
                components: buildEditRows(name),
                ephemeral: true,
            });
        }
    },
};
