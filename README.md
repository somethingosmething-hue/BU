# Mimu Dashboard

A Discord bot with a web dashboard - deployable to Vercel!

## Deployment

1. Push to GitHub
2. Go to [Vercel](https://vercel.com)
3. Import the repo
4. Set environment variable `DASHBOARD_PASSWORD` (default: `mimuadmin`)
5. Deploy!

## Dashboard URL
- After deploy, visit your Vercel URL
- Login with password: `mimuadmin` (or your custom password)

## Features
- Embed Editor (visual block-based)
- Custom Command Manager
- Autoresponder Manager
- Variables Viewer
- Server Settings

## Bot vs Website
- `bot/` - Discord bot code
- `website/` - Web dashboard

## Running locally
```bash
npm install
npm run web   # Website only
npm run bot   # Bot only
npm start     # Both
```