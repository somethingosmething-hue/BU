const { Client, GatewayIntentBits, Collection, Partials, REST, Routes, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const db = require('./database/db');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Reaction, Partials.User],
});

client.commands = new Collection();

// Load commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (command.data && command.execute) {
    client.commands.set(command.data.name, command);
  }
}

// Load events
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'));
for (const file of eventFiles) {
  const event = require(path.join(eventsPath, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
}

// Handle giveaway button interactions
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;
  if (!interaction.customId.startsWith('gw-enter-')) return;

  const msgId = interaction.message.id;
  const guildId = interaction.guild.id;
  const userId = interaction.user.id;

  const gw = db.getGiveaway(guildId, msgId);
  if (!gw || gw.ended) {
    return interaction.reply({ content: '❌ This giveaway has ended.', ephemeral: true });
  }

  if (!gw.entries) gw.entries = [];

  if (gw.entries.includes(userId)) {
    return interaction.reply({ content: 'You have already entered this giveaway.', ephemeral: true });
  }

  gw.entries.push(userId);
  db.saveGiveaway(guildId, msgId, gw);

  // Update embed with new entry count
  try {
    const embed = EmbedBuilder.from(interaction.message.embeds[0])
      .spliceFields(2, 1, { name: 'Entries:', value: `**${gw.entries.length}**`, inline: true });
    await interaction.message.edit({ embeds: [embed] });
  } catch (e) {}

  await interaction.reply({ content: 'You have entered this giveaway!', ephemeral: true });
});

db.connectDB().then(async () => {
  console.log('Bot starting...');
  await client.login(process.env.BOT_TOKEN);
}).catch(err => {
  console.error('Failed to connect to MongoDB:', err);
  process.exit(1);
});

client.once('ready', async () => {
  const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

  // Separate global commands (user app) from guild commands (server bot)
  const globalCommands = client.commands.filter(cmd =>
    ['eshowcurlist', 'enumcurlist'].includes(cmd.data.name)
  ).map(cmd => cmd.data.toJSON());

  const guildCommands = client.commands.filter(cmd =>
    !['eshowcurlist', 'enumcurlist'].includes(cmd.data.name)
  ).map(cmd => cmd.data.toJSON());

  // Register global commands (available everywhere as user app)
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: globalCommands });
    console.log('Global (user app) commands registered.');
  } catch (e) {
    console.error('Global command registration failed:', e.message);
  }

  // Clear and register guild commands for each server
  for (const guild of client.guilds.cache.values()) {
    try {
      await rest.put(Routes.applicationGuildCommands(client.user.id, guild.id), { body: guildCommands });
    } catch (e) {
      console.error(`Failed to register guild commands for ${guild.id}:`, e.message);
    }
  }
  console.log('Guild commands registered.');

  for (const guild of client.guilds.cache.values()) {
    try {
      await guild.members.fetch();
      await guild.channels.fetch();
      const channels = guild.channels.cache
        .filter(c => c.type === 0)
        .map(c => ({ id: c.id, name: c.name, parentId: c.parentId }))
        .sort((a, b) => a.name.localeCompare(b.name));
      await db.collection('channels').updateOne(
        { guildId: guild.id },
        { $set: { guildId: guild.id, channels, updatedAt: Date.now() } },
        { upsert: true }
      );
    } catch (e) { console.error('Channel sync error:', e.message); }
  }
  console.log(`Synced channels for ${client.guilds.cache.size} guilds`);

  setInterval(async () => {
    for (const guild of client.guilds.cache.values()) {
      try {
        await guild.channels.fetch();
        const channels = guild.channels.cache
          .filter(c => c.type === 0)
          .map(c => ({ id: c.id, name: c.name, parentId: c.parentId }))
          .sort((a, b) => a.name.localeCompare(b.name));
        await db.collection('channels').updateOne(
          { guildId: guild.id },
          { $set: { guildId: guild.id, channels, updatedAt: Date.now() } },
          { upsert: true }
        );
      } catch (e) {}
    }
  }, 60000);
});

client.on('guildCreate', async (guild) => {
  try {
    const channels = guild.channels.cache
      .filter(c => c.type === 0)
      .map(c => ({ id: c.id, name: c.name, parentId: c.parentId }))
      .sort((a, b) => a.name.localeCompare(b.name));
    await db.collection('channels').updateOne(
      { guildId: guild.id },
      { $set: { guildId: guild.id, channels, updatedAt: Date.now() } },
      { upsert: true }
    );
  } catch (e) { console.error('Channel sync error:', e.message); }
});

setInterval(async () => {
  try {
    const pending = await db.getPendingSends();
    for (const send of pending) {
      const channel = client.channels.cache.get(send.channelId);
      if (!channel) continue;
      const embedData = await db.getEmbed(send.guildId, send.name);
      if (!embedData) continue;
      const embed = buildEmbed(embedData);
      await channel.send(embed).catch(console.error);
      await db.deletePendingSend(send.guildId, send.name);
    }
  } catch (e) { console.error('Send loop error:', e.message); }
}, 5000);

// Giveaway checker - runs every 15 seconds
setInterval(async () => {
  try {
    const giveaways = await db.getCollection('giveaways').find({}).toArray();

    for (const doc of giveaways) {
      const guildId = doc.guildId;
      const giveawayData = doc.data || {};

      for (const [msgId, gw] of Object.entries(giveawayData)) {
        if (gw.ended || !gw.endsAt) continue;
        if (Date.now() < gw.endsAt) continue;

        // Giveaway has ended
        try {
          const channel = await client.channels.fetch(gw.channelId).catch(() => null);
          if (!channel) continue;

          const message = await channel.messages.fetch(msgId).catch(() => null);
          if (!message) continue;

          // Pick winners from entries
          const entries = gw.entries || [];
          const winnerCount = Math.min(gw.winners || 1, entries.length);
          const winners = [];

          const shuffled = [...entries].sort(() => Math.random() - 0.5);
          for (let i = 0; i < winnerCount; i++) {
            winners.push(shuffled[i]);
          }

          // Update embed
          const endedEmbed = new EmbedBuilder()
            .setColor('#f9c4d2')
            .setTitle(gw.title)
            .setDescription(gw.description || '')
            .addFields(
              { name: 'Ended:', value: `<t:${Math.floor(gw.endsAt / 1000)}:F> (<t:${Math.floor(gw.endsAt / 1000)}:R>)`, inline: false },
              { name: 'Hosted by:', value: `<@${gw.hostId}>`, inline: true },
              { name: 'Entries:', value: `**${entries.length}**`, inline: true },
              { name: 'Winners:', value: winners.map(id => `<@${id}>`).join(', ') || 'None', inline: true }
            )
            .setFooter({ text: `Started: ${new Date(gw.startedAt).toLocaleString()}` });

          const disabledBtn = new ButtonBuilder()
            .setCustomId('gw-disabled')
            .setLabel('🎉')
            .setStyle(ButtonStyle.Success)
            .setDisabled(true);

          const row = new ActionRowBuilder().addComponents(disabledBtn);

          await message.edit({ embeds: [endedEmbed], components: [row] }).catch(() => {});

          // Send winner announcement
          if (winners.length > 0) {
            const winnerMentions = winners.map(id => `<@${id}>`).join(', ');
            await channel.send({ content: `Congratulations ${winnerMentions}! You won the **${gw.title}**!` }).catch(() => {});
          }

          // Mark as ended
          gw.ended = true;
          gw.winnerIds = winners;
          await db.saveGiveaway(guildId, msgId, gw);

        } catch (e) {
          console.error('Giveaway end error:', e.message);
        }
      }
    }
  } catch (e) {
    console.error('Giveaway checker error:', e.message);
  }
}, 15000);

function buildEmbed(data) {
  const embed = {};
  if (data.color) embed.color = parseInt(data.color.replace('#', ''), 16);
  if (data.author) {
    embed.author = { name: data.author };
    if (data.authorIcon) embed.author.icon_url = data.authorIcon;
  }
  if (data.title) {
    embed.title = data.title;
    if (data.url) embed.url = data.url;
  }
  if (data.description) embed.description = data.description;
  if (data.fields?.length) embed.fields = data.fields;
  if (data.image) embed.image = { url: data.image };
  if (data.thumbnail) embed.thumbnail = { url: data.thumbnail };
  if (data.footer || data.timestamp) {
    embed.footer = { text: data.footer || '' };
    if (data.footerIcon) embed.footer.icon_url = data.footerIcon;
  }
  return { embeds: [embed] };
}
