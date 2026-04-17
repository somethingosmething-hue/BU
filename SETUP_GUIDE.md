# 🤖 Mimu Clone — Setup Guide
> A beginner-friendly Discord bot with **unlimited embeds**, autoresponders, button roles, and economy!

---

## 📋 What You'll Need
- A computer (Windows, Mac, or Linux)
- A Discord account with a server you manage
- About 15–20 minutes

---

## STEP 1 — Install Node.js

Node.js is what runs the bot.

1. Go to **https://nodejs.org**
2. Download the **LTS** version (the left green button)
3. Install it — just click Next through everything
4. To check it worked, open a terminal/command prompt and type:
   ```
   node --version
   ```
   You should see something like `v20.x.x` ✅

---

## STEP 2 — Create Your Discord Bot

1. Go to **https://discord.com/developers/applications**
2. Click **"New Application"** — give it a name (e.g. "My Bot")
3. Click **"Bot"** in the left sidebar
4. Click **"Reset Token"** → Copy that token and save it somewhere safe!
   > ⚠️ NEVER share your token with anyone. It's like a password.
5. Scroll down and turn ON these options:
   - ✅ **Message Content Intent**
   - ✅ **Server Members Intent**
   - ✅ **Presence Intent**

---

## STEP 3 — Invite the Bot to Your Server

1. In the Developer Portal, click **"OAuth2"** in the left sidebar
2. Click **"URL Generator"**
3. Under **Scopes**, check: `bot` and `applications.commands`
4. Under **Bot Permissions**, check:
   - ✅ Send Messages
   - ✅ Embed Links
   - ✅ Read Message History
   - ✅ Manage Roles
   - ✅ Add Reactions
   - ✅ Use External Emojis
5. Copy the URL at the bottom and open it in your browser
6. Select your server and click **Authorize**

---

## STEP 4 — Set Up the Bot Files

1. Download or copy the bot files into a folder on your computer (e.g. `my-bot`)
2. Open a terminal/command prompt **in that folder**
   - Windows: Right-click the folder → "Open in Terminal"
   - Mac: Right-click → "New Terminal at Folder"
3. Run this command to install dependencies:
   ```
   npm install
   ```
4. Find the file called `.env.example` and **rename it to `.env`**
5. Open `.env` and replace `your_token_here` with the token you copied in Step 2:
   ```
   BOT_TOKEN=paste_your_token_here
   ```

---

## STEP 5 — Start the Bot!

In your terminal, run:
```
npm start
```

You should see:
```
✅ Logged in as YourBot#1234
🔄 Registering slash commands...
✅ Registered 5 slash commands!
```

Your bot is now online! 🎉

> **Note:** The bot only runs while your terminal is open. See "Keeping the Bot Online 24/7" below.

---

## 🧪 Testing Your Bot

Type `/` in your Discord server and you should see these commands appear:

| Command | What it does |
|---|---|
| `/embed` | Create/edit/send custom embeds (unlimited!) |
| `/send` | Send an embed or button panel to a channel |
| `/autoresponder` | Set up trigger → response pairs |
| `/buttonresponder` | Create clickable buttons |
| `/economy` | Balance, daily, work, pay, leaderboard |

---

## 📖 Quick Examples

### Make an embed and send it:
```
/embed create name:welcome title:Welcome! description:Welcome to our server!\nPlease read the rules. color:#f9c4d2
/send content:{embed:welcome} channel:#welcome
```

### Autoresponder with role:
```
/autoresponder add trigger:+gamer reply:{embed:#c9b8f5} gave you the gamer role! {addrole:@Gamer}
```

### Button role panel:
```
/buttonresponder add name:get_gamer reply:{addrole:@Gamer}{embed:#a8d8ea} ✅ gave you @Gamer! label:🎮 Gamer color:green
/buttonresponder add name:get_artist reply:{addrole:@Artist}{embed:#a8d8ea} ✅ gave you @Artist! label:🎨 Artist color:green
/send content:{embed:roles_panel}{addbutton:get_gamer}{addbutton:get_artist} channel:#roles
```

### Supported variables:
| Variable | What it does |
|---|---|
| `{embed:#hexcolor}` | Colored embed (no slot used) |
| `{embed:name}` | Use a saved embed |
| `{addrole:@RoleName}` | Give the user a role |
| `{removerole:@RoleName}` | Remove a role |
| `{addbutton:name}` | Attach a button |
| `{addlinkbutton: label \| url}` | Link button |
| `{newline}` | Line break |
| `{user_name}` | User's username |
| `{user_mention}` | @mentions the user |
| `{server_name}` | Server name |
| `{member_count}` | Server member count |
| `{date}` | Today's date |
| `{requirerole:@Role}` | Only allow users with this role |
| `{cooldown:seconds}` | Add a cooldown |

---

## ☁️ Keeping the Bot Online 24/7

Your bot stops when you close the terminal. To keep it running:

### Free option: Railway
1. Go to **https://railway.app** and sign up
2. Click "New Project" → "Deploy from GitHub"
3. Push your bot files to a GitHub repo first, then connect it
4. Add your `BOT_TOKEN` as an environment variable in Railway's settings
5. Done — Railway keeps it running for free (with some limits)

### Free option: Render
1. Go to **https://render.com**
2. Create a "Web Service" from your GitHub repo
3. Set start command to `npm start`
4. Add `BOT_TOKEN` as an environment variable

---

## ❓ Troubleshooting

**Bot is online but commands don't show up:**
- Wait 1–2 minutes for Discord to register them
- Make sure the bot has the `applications.commands` scope

**"Missing Permissions" error on roles:**
- The bot's role must be **above** the roles it's trying to give in Server Settings → Roles

**Bot goes offline when I close my computer:**
- Use Railway or Render (see above)

**"Invalid Token" error:**
- Double-check your `.env` file has the correct token with no extra spaces

---

Made with 💜 — based on Mimu Bot's concept
