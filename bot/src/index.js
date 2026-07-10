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

  const gw = await db.getGiveaway(guildId, msgId);
  if (!gw || gw.ended) {
    return interaction.reply({ content: '❌ This giveaway has ended.', flags: 64 });
  }

  if (!gw.entries) gw.entries = [];

  if (gw.entries.includes(userId)) {
    return interaction.reply({ content: 'You have already entered this giveaway.', flags: 64 });
  }

  gw.entries.push(userId);
  await db.saveGiveaway(guildId, msgId, gw);

  // Update embed with new entry count
  try {
    const oldEmbed = interaction.message.embeds[0];
    const embed = EmbedBuilder.from(oldEmbed)
      .spliceFields(2, 1, { name: 'Entries:', value: `**${gw.entries.length}**`, inline: true });
    await interaction.message.edit({ embeds: [embed] });
  } catch (e) {}

  await interaction.reply({ content: 'You have entered this giveaway!', flags: 64 });
});



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

async function findBusiestChannel(guild) {
  let busiest = null;
  let bestTimestamp = 0;
  try { await guild.channels.fetch(); } catch {}
  const textChannels = guild.channels.cache.filter(c => c.type === 0);

  // Use lastMessageId (cached, instant, no API calls) to find most recently active channel
  for (const [, channel] of textChannels) {
    if (channel.lastMessageId) {
      try {
        const ts = Number(BigInt(channel.lastMessageId) >> 22n);
        if (ts > bestTimestamp) {
          bestTimestamp = ts;
          busiest = channel;
        }
      } catch {}
    }
  }
  return busiest;
}

function setupGracefulShutdown() {
  let shuttingDown = false;
  async function onShutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Received ${signal}, shutting down gracefully...`);
    try {
      // Mark clean shutdown so next startup doesn't send retroactive "down" message
      await db.getCollection('botstatus').updateOne(
        { key: 'heartbeat' },
        { $set: { cleanShutdown: true, stoppedAt: Date.now() } },
        { upsert: true }
      );
      for (const [, guild] of client.guilds.cache) {
        try {
          const channel = await findBusiestChannel(guild);
          if (!channel) continue;
          console.log(`Sending shutdown message to #${channel.name} (${channel.id}) in ${guild.id}`);
          const shutdownEmbed = new EmbedBuilder()
            .setColor('#9EFFCA')
            .setDescription(`<a:OwO1:1524863682599977071><a:OwO2:1524863704682860836> <@1494498067888476230> is back up! It has been updated.\n-# <:smolheart:1490431051007525048> For any problems or bugs, contact <@1486469966332170392>.`);
          await channel.send({ embeds: [shutdownEmbed] });
          // Save where we sent it so startup can send "back up" there
          await db.getCollection('botstatus').updateOne(
            { key: 'shutdown' },
            { $set: { guildId: guild.id, channelId: channel.id } },
            { upsert: true }
          );
          console.log('Shutdown message sent.');
        } catch (e) { console.error('Shutdown message error:', e.message); }
      }
    } catch (e) {
      console.error('Shutdown failed:', e);
    }
    process.exit(0);
  }
  process.on('SIGINT', () => onShutdown('SIGINT'));
  process.on('SIGTERM', () => onShutdown('SIGTERM'));
  process.on('SIGHUP', () => onShutdown('SIGHUP'));
}

db.connectDB().then(async () => {
  console.log('Bot starting...');
  setupGracefulShutdown();
  await client.login(process.env.BOT_TOKEN);
}).catch(err => {
  console.error('Failed to connect to MongoDB:', err);
  process.exit(1);
});

client.once('clientReady', async () => {
  const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

  // Separate global commands (user app) from guild commands (server bot)
  const globalCommands = client.commands.filter(cmd =>
    ['eshowcurlist', 'enumcurlist', 'etotalnumcurlist'].includes(cmd.data.name)
  ).map(cmd => cmd.data.toJSON());

  const guildCommands = client.commands.filter(cmd =>
    !['eshowcurlist', 'enumcurlist', 'etotalnumcurlist'].includes(cmd.data.name)
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

  // Channel sync on ready
  for (const guild of client.guilds.cache.values()) {
    try {
      await guild.members.fetch();
      await guild.channels.fetch();
      const channels = guild.channels.cache
        .filter(c => c.type === 0)
        .map(c => ({ id: c.id, name: c.name, parentId: c.parentId }))
        .sort((a, b) => a.name.localeCompare(b.name));
      await db.getCollection('channels').updateOne(
        { guildId: guild.id },
        { $set: { guildId: guild.id, channels, updatedAt: Date.now() } },
        { upsert: true }
      );
    } catch (e) { console.error('Channel sync error:', e.message); }
    // Delay between guilds to avoid rate limits
    await new Promise(r => setTimeout(r, 2000));
  }
  console.log(`Synced channels for ${client.guilds.cache.size} guilds`);

  // Start intervals only after DB is connected
  // Channel sync interval
  let channelSyncRunning = false;
  setInterval(async () => {
    if (channelSyncRunning) return;
    channelSyncRunning = true;
    try {
    for (const guild of client.guilds.cache.values()) {
      try {
        await guild.channels.fetch();
        const channels = guild.channels.cache
          .filter(c => c.type === 0)
          .map(c => ({ id: c.id, name: c.name, parentId: c.parentId }))
          .sort((a, b) => a.name.localeCompare(b.name));
        await db.getCollection('channels').updateOne(
          { guildId: guild.id },
          { $set: { guildId: guild.id, channels, updatedAt: Date.now() } },
          { upsert: true }
        );
        // Delay to avoid rate limits
        await new Promise(r => setTimeout(r, 2000));
      } catch (e) {}
    }
    } finally { channelSyncRunning = false; }
  }, 60000);

  // Pending sends interval
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

  // Bump reminder recovery (catch missed reminders after restart)
  const bumpHandler = require('./events/bumpHandler');
  try {
    const pendingReminders = await db.getPendingBumpReminders();
    for (const r of pendingReminders) {
      const remaining = r.remindAt - Date.now();
      if (remaining <= 0) {
        bumpHandler.sendReminder(client, r);
      } else {
        setTimeout(() => {
          bumpHandler.sendReminder(client, r);
        }, remaining);
      }
    }
    console.log(`Recovered ${pendingReminders.length} pending bump reminders`);
  } catch (e) { console.error('Bump reminder recovery error:', e.message); }

  // Regular reminder checker - runs every 30 seconds
  setInterval(async () => {
    try {
      const reminders = await db.getReminders();
      for (const [id, r] of Object.entries(reminders)) {
        if (Date.now() >= r.at) {
          const user = await client.users.fetch(r.userId).catch(() => null);
          if (user) {
            await user.send({ content: `⏰ **Reminder:** ${r.text}` }).catch(() => {});
          }
          delete reminders[id];
        }
      }
      await db.saveReminders(reminders);
    } catch (e) { console.error('Reminder check error:', e.message); }
  }, 30000);

  // Bump reminder checker - runs every 30 seconds
  setInterval(async () => {
    try {
      const reminders = await db.getPendingBumpReminders();
      for (const r of reminders) {
        if (Date.now() >= r.remindAt) {
          await bumpHandler.sendReminder(client, r);
        }
      }
    } catch (e) { console.error('Bump reminder check error:', e.message); }
  }, 30000);

  // Note sticky recovery - refresh notes that went missing after restart
  const noteSticky = require('./events/noteSticky');
  try {
    const guilds = client.guilds.cache.values();
    for (const guild of guilds) {
      const notes = await db.getAllNotes(guild.id);
      for (const note of notes) {
        const channel = client.channels.cache.get(note.channelId);
        if (!channel) continue;
        const msg = await channel.messages.fetch(note.messageId).catch(() => null);
        if (!msg) {
          await noteSticky.refreshNote(guild.id, channel, note);
        }
      }
    }
    console.log('Recovered sticky notes after restart');
  } catch (e) { console.error('Note recovery error:', e.message); }

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

            const shuffled = [...entries];
            for (let i = shuffled.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
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

  // Startup message — detect unexpected shutdown & send status messages
  try {
    // Check if notifications are suppressed for this restart
    const suppressDoc = await db.getCollection('botstatus').findOne({ key: 'suppressNoti' });
    const suppressed = suppressDoc?.suppress === true;
    if (suppressed) {
      console.log('Back-up/down notifications suppressed for this restart.');
      await db.getCollection('botstatus').deleteOne({ key: 'suppressNoti' });
      // Clean up any pending shutdown status so no messages fire
      await db.getCollection('botstatus').deleteOne({ key: 'shutdown' });
      // Still mark heartbeat as running
      await db.getCollection('botstatus').updateOne(
        { key: 'heartbeat' },
        { $set: { cleanShutdown: true, startedAt: Date.now(), busiestChannels: {} } },
        { upsert: true }
      );
    } else {
      const heartbeat = await db.getCollection('botstatus').findOne({ key: 'heartbeat' });
      const shutdownStatus = await db.getCollection('botstatus').findOne({ key: 'shutdown' });

      // If there was a previous instance that DIDN'T shut down cleanly, send retroactive "down" message
      if (heartbeat && !heartbeat.cleanShutdown && heartbeat.busiestChannels) {
        console.log('Detected unexpected shutdown — sending retroactive down messages...');
        for (const [guildId, info] of Object.entries(heartbeat.busiestChannels)) {
          if (shutdownStatus && shutdownStatus.guildId === guildId) continue; // already sent cleanly
          try {
            const channel = client.channels.cache.get(info.channelId) || await client.channels.fetch(info.channelId).catch(() => null);
            if (channel) {
              const downEmbed = new EmbedBuilder()
                .setColor('#FF9E9E')
               .setDescription(`<a:OwO1:1524863682599977071><a:OwO2:1524863704682860836> <@1494498067888476230> is back up! It has been updated.\n-# <:smolheart:1490431051007525048> For any problems or bugs, contact <@1486469966332170392>.`);
              await channel.send({ embeds: [downEmbed] });
              console.log(`Retroactive down message sent to #${info.channelName} in ${guildId}`);
              // Save this as the shutdown channel for the upcoming "back up" message
              await db.getCollection('botstatus').updateOne(
                { key: 'shutdown' },
                { $set: { guildId, channelId: info.channelId } },
                { upsert: true }
              );
            }
          } catch (e) { console.error('Retroactive down message error:', e.message); }
        }
      }

      // Send "back up" message if bot was previously down
      if (shutdownStatus) {
        let channel = client.channels.cache.get(shutdownStatus.channelId);
        if (!channel) {
          try { channel = await client.channels.fetch(shutdownStatus.channelId); } catch {}
        }
        if (channel) {
          console.log(`Sending back-up message to #${channel.name} (${channel.id})`);
          const startupEmbed = new EmbedBuilder()
            .setColor('#9EFFCA')
            .setDescription(`<a:OwO1:1524863682599977071><a:OwO2:1524863704682860836> <@1494498067888476230> is back up! Thank you for your patience.`);
          await channel.send({ embeds: [startupEmbed] });
          console.log('Back-up message sent.');
        }
        await db.getCollection('botstatus').deleteOne({ key: 'shutdown' });
      }

      // Mark this instance as running (cleanShutdown=false so next startup knows it was unexpected)
      await db.getCollection('botstatus').updateOne(
        { key: 'heartbeat' },
        { $set: { cleanShutdown: false, startedAt: Date.now(), busiestChannels: {} } },
        { upsert: true }
      );
    }
  } catch (e) { console.error('Startup status error:', e.message); }

  // Heartbeat: periodically save busiest channel per guild + mark as alive
  setInterval(async () => {
    try {
      const busiestChannels = {};
      for (const [guildId, guild] of client.guilds.cache) {
        const channel = await findBusiestChannel(guild);
        if (channel) {
          busiestChannels[guildId] = { channelId: channel.id, channelName: channel.name };
        }
      }
      await db.getCollection('botstatus').updateOne(
        { key: 'heartbeat' },
        { $set: { cleanShutdown: false, lastBeat: Date.now(), busiestChannels } },
        { upsert: true }
      );
    } catch (e) { console.error('Heartbeat error:', e.message); }
  }, 300000); // every 5 minutes
});

client.on('guildCreate', async (guild) => {
  try {
    const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
    const guildCommands = client.commands.filter(cmd =>
      !['eshowcurlist', 'enumcurlist', 'etotalnumcurlist'].includes(cmd.data.name)
    ).map(cmd => cmd.data.toJSON());
    await rest.put(Routes.applicationGuildCommands(client.user.id, guild.id), { body: guildCommands });
    console.log(`Registered guild commands for new guild ${guild.id}`);
  } catch (e) {
    console.error(`Failed to register guild commands for ${guild.id}:`, e.message);
  }

  try {
    await guild.channels.fetch();
    const channels = guild.channels.cache
      .filter(c => c.type === 0)
      .map(c => ({ id: c.id, name: c.name, parentId: c.parentId }))
      .sort((a, b) => a.name.localeCompare(b.name));
    await db.getCollection('channels').updateOne(
      { guildId: guild.id },
      { $set: { guildId: guild.id, channels, updatedAt: Date.now() } },
      { upsert: true }
    );
  } catch (e) { console.error('Channel sync error:', e.message); }
});
