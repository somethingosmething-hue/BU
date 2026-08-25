const { SlashCommandBuilder, Routes } = require('discord.js');

const WRITING_EMOJI = '<:writing:1526779827611500604>';
const DIVIDER1 = '<:divider1:1536178165972607038>';
const DIVIDER2 = '<:divider2:1536178189762826240>';
const CHECKOUT_EMOJI = '<:checkout:1536178354384928868>';

const RESET_BUTTONS = {
  name: 'btn_1787673542107_7tty',
  pfp: 'btn_1787673576408_rhm3',
  banner: 'btn_1787673593216_d0fd',
  bio: 'btn_1787673614363_jhtx',
};

const NAME_LIMIT = 32;
const BIO_LIMIT = 190;

function buildCommandData(name) {
  return new SlashCommandBuilder()
    .setName(name)
    .setDescription("Update the bot's server-specific profile (name, pfp, banner, bio)")
    .addStringOption(o => o.setName('name').setDescription('New display name for this server').setMaxLength(NAME_LIMIT))
    .addStringOption(o => o.setName('pfp_url').setDescription('Link to the new profile picture (direct image URL)').setMaxLength(2000))
    .addAttachmentOption(o => o.setName('pfp_upload').setDescription('Upload the new profile picture'))
    .addStringOption(o => o.setName('banner_url').setDescription('Link to the new banner (direct image URL)').setMaxLength(2000))
    .addAttachmentOption(o => o.setName('banner_upload').setDescription('Upload the new banner'))
    .addStringOption(o => o.setName('bio').setDescription('New bio ({newline}, \\n and %nl% all create a new line)').setMaxLength(400))
    .addStringOption(o => o.setName('reset').setDescription('Reset something back to its default (removes it)')
      .addChoices(
        { name: 'name', value: 'name' },
        { name: 'pfp', value: 'pfp' },
        { name: 'banner', value: 'banner' },
        { name: 'bio', value: 'bio' },
        { name: 'all', value: 'all' },
      ));
}

// Turns {newline}, \n and %nl% into real line breaks
function processNewlines(text) {
  return String(text)
    .replace(/\{newline\}/gi, '\n')
    .replace(/%nl%/gi, '\n')
    .replace(/\\n/g, '\n');
}

function quoteBio(bio) {
  if (!bio || !bio.trim()) return '*No bio set.*';
  return bio.split('\n').map(l => (l.length ? `> ${l}` : '>')).join('\n');
}

async function getCurrentProfile(guild, memberOverride = null) {
  const member = memberOverride || guild.members.me;
  if (!member) throw new Error('Could not find my own member in this server.');

  let bio = null;
  try {
    const raw = await guild.client.rest.get(Routes.guildMember(guild.id, guild.client.user.id));
    if (raw && typeof raw.bio === 'string') bio = raw.bio;
  } catch {}

  const pfpUrl = member.displayAvatarURL({ extension: 'png', size: 1024 });
  const bannerUrl = member.displayBannerURL({ extension: 'png', size: 1024 }) || pfpUrl;

  return { name: member.displayName, pfpUrl, bannerUrl, bio };
}

function buildSuccessPayload(profile) {
  return {
    flags: 32768,
    components: [
      {
        type: 17,
        components: [
          {
            type: 10,
            content: `## ${WRITING_EMOJI} Server Profile Updated`,
          },
          {
            type: 14,
            spacing: 2,
            divider: true,
          },
          {
            type: 14,
            spacing: 2,
            divider: false,
          },
          {
            type: 10,
            content: `### ${DIVIDER1} Current name: \`${profile.name}\``,
          },
          {
            type: 14,
            spacing: 2,
            divider: false,
          },
          {
            type: 10,
            content: `### ${DIVIDER1} Current PFP:`,
          },
          {
            type: 12,
            items: [
              {
                media: {
                  url: profile.pfpUrl,
                },
              },
            ],
          },
          {
            type: 14,
            spacing: 2,
            divider: false,
          },
          {
            type: 10,
            content: `### ${DIVIDER1} Current banner:`,
          },
          {
            type: 12,
            items: [
              {
                media: {
                  url: profile.bannerUrl,
                },
              },
            ],
          },
          {
            type: 14,
            spacing: 2,
            divider: false,
          },
          {
            type: 10,
            content: `### ${DIVIDER2} Current bio:\n${quoteBio(profile.bio)}`,
          },
        ],
      },
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 2,
            label: 'Reset Name',
            custom_id: RESET_BUTTONS.name,
            emoji: {
              id: '1536481862954786856',
              name: 'blue1',
              animated: false,
            },
          },
          {
            type: 2,
            style: 2,
            label: 'Reset PFP',
            custom_id: RESET_BUTTONS.pfp,
            emoji: {
              id: '1536481890331000963',
              name: 'blue2',
              animated: false,
            },
          },
          {
            type: 2,
            style: 2,
            label: 'Reset Banner',
            custom_id: RESET_BUTTONS.banner,
            emoji: {
              id: '1536481918739030036',
              name: 'blue3',
              animated: false,
            },
          },
          {
            type: 2,
            style: 2,
            label: 'Reset Bio',
            custom_id: RESET_BUTTONS.bio,
            emoji: {
              id: '1536481957008121916',
              name: 'blue4',
              animated: false,
            },
          },
        ],
      },
    ],
  };
}

function buildErrorPayload(reason) {
  return {
    flags: 32768,
    components: [
      {
        type: 17,
        accent_color: 14574435,
        components: [
          {
            type: 10,
            content: `${CHECKOUT_EMOJI} **Error updating profile**: ${reason}`,
          },
        ],
      },
    ],
  };
}

function assertImageAttachment(attachment, label) {
  if (!attachment?.url) throw new Error(`${label} could not be read.`);
  const contentType = attachment.contentType || '';
  if (!contentType.startsWith('image/')) throw new Error(`${label} must be an image file.`);
  return attachment.url;
}

async function validateImageUrl(raw, label) {
  let url;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error(`${label} is not a valid link.`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`${label} must be a direct http(s) image link.`);
  }

  try {
    let res = await fetch(url, { method: 'HEAD' });
    let contentType = res.headers.get('content-type') || '';
    if (!res.ok || !contentType.startsWith('image/')) {
      res = await fetch(url);
      contentType = res.headers.get('content-type') || '';
    }
    if (!res.ok || !contentType.startsWith('image/')) {
      throw new Error('not an image');
    }
  } catch (e) {
    if (e instanceof TypeError) {
      throw new Error(`${label} is not a valid link.`);
    }
    throw new Error(`${label} does not point to a valid image.`);
  }

  return url.toString();
}

async function execute(interaction) {
  try {
    await interaction.deferReply({ flags: 32768 });
  } catch {}

  try {
    if (!interaction.inGuild() || !interaction.guild) {
      throw new Error('This command can only be used inside a server.');
    }

    const opts = interaction.options;
    const name = opts.getString('name');
    const pfpUrlRaw = opts.getString('pfp_url');
    const pfpUpload = opts.getAttachment('pfp_upload');
    const bannerUrlRaw = opts.getString('banner_url');
    const bannerUpload = opts.getAttachment('banner_upload');
    const bioRaw = opts.getString('bio');
    const reset = opts.getString('reset');

    const hasAny = [name, pfpUrlRaw, pfpUpload, bannerUrlRaw, bannerUpload, bioRaw, reset]
      .some(v => v !== null && v !== undefined);

    // Nothing provided — just show the current profile
    if (!hasAny) {
      const profile = await getCurrentProfile(interaction.guild);
      return interaction.editReply(buildSuccessPayload(profile)).catch(() => {});
    }

    // Everything is validated BEFORE anything gets applied.
    // All changes go through a single editMe() call, so if any of it fails nothing is modified at all.
    const updates = {};

    if (reset === 'name') updates.nick = null;
    else if (reset === 'pfp') updates.avatar = null;
    else if (reset === 'banner') updates.banner = null;
    else if (reset === 'bio') updates.bio = null;
    else if (reset === 'all') {
      updates.nick = null;
      updates.avatar = null;
      updates.banner = null;
      updates.bio = null;
    }

    if (name !== null && name !== undefined) {
      const trimmed = name.trim();
      if (!trimmed) throw new Error('The name cannot be empty.');
      if (trimmed.length > NAME_LIMIT) throw new Error(`The name must be ${NAME_LIMIT} characters or fewer.`);
      updates.nick = trimmed;
    }

    if (pfpUpload) {
      updates.avatar = assertImageAttachment(pfpUpload, '`pfp_upload`');
    } else if (pfpUrlRaw !== null && pfpUrlRaw !== undefined) {
      updates.avatar = await validateImageUrl(pfpUrlRaw, '`pfp_url`');
    }

    if (bannerUpload) {
      updates.banner = assertImageAttachment(bannerUpload, '`banner_upload`');
    } else if (bannerUrlRaw !== null && bannerUrlRaw !== undefined) {
      updates.banner = await validateImageUrl(bannerUrlRaw, '`banner_url`');
    }

    if (bioRaw !== null && bioRaw !== undefined) {
      const bio = processNewlines(bioRaw);
      if (bio.length > BIO_LIMIT) throw new Error(`The bio must be ${BIO_LIMIT} characters or fewer.`);
      updates.bio = bio;
    }

    if (!Object.keys(updates).length) {
      const profile = await getCurrentProfile(interaction.guild);
      return interaction.editReply(buildSuccessPayload(profile)).catch(() => {});
    }

    const updatedMember = await interaction.guild.members.editMe(updates);
    const profile = await getCurrentProfile(interaction.guild, updatedMember);
    return interaction.editReply(buildSuccessPayload(profile)).catch(() => {});
  } catch (err) {
    console.error('[disguise] Failed:', err);
    const payload = buildErrorPayload(err?.message || 'Unknown error.');
    if (interaction.deferred && !interaction.replied) {
      return interaction.editReply(payload).catch(() => {});
    }
    if (interaction.replied || interaction.deferred) {
      return interaction.followUp(payload).catch(() => {});
    }
    return interaction.reply(payload).catch(() => {});
  }
}

async function handleResetButton(interaction) {
  const target = Object.entries(RESET_BUTTONS).find(([, id]) => id === interaction.customId)?.[0];
  if (!target) return false;

  try {
    const updates =
      target === 'name' ? { nick: null } :
      target === 'pfp' ? { avatar: null } :
      target === 'banner' ? { banner: null } :
      { bio: null };

    const updatedMember = await interaction.guild.members.editMe(updates);
    const profile = await getCurrentProfile(interaction.guild, updatedMember);
    await interaction.update(buildSuccessPayload(profile));
  } catch (err) {
    console.error('[disguise] Reset failed:', err);
    const payload = buildErrorPayload(err?.message || 'Unknown error.');
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload).catch(() => {});
    } else {
      await interaction.reply(payload).catch(() => {});
    }
  }
  return true;
}

module.exports = {
  permissions: ['ManageGuild'],
  data: buildCommandData('disguise'),
  aliasData: [
    buildCommandData('serverprofile'),
    buildCommandData('profile'),
    buildCommandData('setserverprofile'),
  ],
  RESET_BUTTONS,
  execute,
  handleResetButton,
};
