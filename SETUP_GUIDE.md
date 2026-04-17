# 🤖 Mimu2 — Setup Guide
> A Discord bot with **divembs** (Message Components V2), custom commands, user variables, autoresponders, and more!

---

## What You'll Need
- A computer (Windows, Mac, or Linux)
- A Discord account with a server you manage
- About 15–20 minutes

---

## STEP 1 — Install Node.js

1. Go to **https://nodejs.org**
2. Download the **LTS** version
3. Install it
4. Verify by running: `node --version` in terminal

---

## STEP 2 — Create Your Discord Bot

1. Go to **https://discord.com/developers/applications**
2. Click **"New Application"** — name it (e.g. "My Bot")
3. Click **"Bot"** in the sidebar
4. Click **"Reset Token"** — copy and save it!
   > ⚠️ NEVER share your token!
5. Turn ON:
   - ✅ **Message Content Intent**
   - ✅ **Server Members Intent**

---

## STEP 3 — Invite the Bot

1. Click **"OAuth2"** → **"URL Generator"**
2. Under **Scopes**, check: `bot` and `applications.commands`
3. Under **Bot Permissions**, check:
   - ✅ Send Messages, ✅ Embed Links, ✅ Read Message History
   - ✅ Manage Roles, ✅ Add Reactions, ✅ Use External Emojis
   - ✅ Manage Channels, ✅ Manage Messages, ✅ Kick/Ban Members
4. Copy the URL, open it in browser, select your server, Authorize

---

## STEP 4 — Set Up Files

1. Download the bot files to a folder
2. Open terminal in that folder
3. Run: `npm install`
4. Rename `.env.example` to `.env`
5. Add your bot token: `BOT_TOKEN=your_token_here`

---

## STEP 5 — Start the Bot!

```bash
npm start
```

You should see:
```
✅ Logged in as YourBot#1234
🔄 Registering slash commands...
✅ Registered slash commands!
```

---

## Commands Overview

| Command | Description |
|---------|-------------|
| `/divemb` | Create Message Components V2 embeds |
| `/embed` | Create/edit/send standard embeds |
| `/ar` (autoresponder) | Trigger → response pairs |
| `/button` | Clickable buttons & select menus |
| `/cc` | Custom slash commands |
| `/cvar` | Custom user variables |
| `/reactevent` | Reaction trigger events |
| `/level` | XP & leveling system |
| `/giveaway` | Host giveaways |
| `/poll` | Create polls |
| `/reminder` | Personal reminders |
| `/mod` | Moderation tools |
| `/reactionrole` | Simple reaction roles |

---

## Quick Examples

### Create a divemb and send it:
```
/divemb create name:welcome
/divemb send name:welcome channel:#welcome
```

### Custom command with variables:
```
/cc add name:greet reply:Hello {user_mention}! You have %%money%% coins.
```

### Create custom economy:
```
/cvar set name:money value:0
/cc add name:daily reply:{cvar:add:money:100} You got 100 coins!
```

### Reaction event for roles:
```
/reactevent add message_id:123456789 emoji:🎮 response:{addrole:Gamer} action:add_role
```

---

## Variables & Placeholders

### Text Placeholders
| Placeholder | Replaces |
|-------------|----------|
| `{user_mention}` | @Username |
| `{user_name}` | Username |
| `{user_tag}` | Username#0000 |
| `{user_id}` | User ID |
| `{user_avatar}` | Avatar URL |
| `{server_name}` | Server name |
| `{server_icon}` | Server icon URL |
| `{member_count}` | Member count |
| `{date}` | Today's date |
| `{time}` | Current time |
| `{timestamp}` | Unix timestamp |
| `{newline}` | Line break |

### Action Placeholders
| Placeholder | Effect |
|-------------|--------|
| `{addrole:RoleName}` | Adds a role |
| `{removerole:RoleName}` | Removes a role |
| `{requirerole:RoleName}` | Blocks if user lacks role |
| `{react:emoji}` | Reacts to message |
| `{embed:name}` | Uses saved embed |
| `{divemb:name}` | Uses saved divemb |
| `{embed:#hex}` | Colored embed |
| `{addbutton:name}` | Attaches button |
| `{addselect:name}` | Attaches select menu |
| `{addlinkbutton:Label\|url}` | Link button |
| `{cooldown:seconds}` | Sets cooldown |

### Custom Variables (%%variable%%)
| Syntax | Description |
|--------|-------------|
| `%%var:name%%` | Get user variable |
| `%%user_var:name%%` | Same as above |
| `%%100 + %%money%%%%` | Math with variables |

---

## Keeping Bot Online 24/7

### Railway (Free)
1. Go to **https://railway.app**
2. Deploy from GitHub
3. Add `BOT_TOKEN` env var

### Render (Free)
1. Go to **https://render.com**
2. Create Web Service from your repo
3. Set start command: `npm start`
4. Add `BOT_TOKEN` env var

---

## Troubleshooting

**Commands don't show up:** Wait 1-2 minutes, or re-invite with `applications.commands`

**"Missing Permissions" on roles:** Bot's role must be **above** the target role in Server Settings → Roles

**"Invalid Token":** Check `.env` has correct token with no extra spaces

---

Made with 💜 — Mimu2 Bot