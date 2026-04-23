const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
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

db.connectDB().then(async () => {
  console.log('Bot starting...');
  await client.login(process.env.BOT_TOKEN);
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
}).catch(err => {
  console.error('Failed to connect to MongoDB:', err);
  process.exit(1);
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
