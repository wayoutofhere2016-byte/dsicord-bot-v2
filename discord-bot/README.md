# All-In-One Discord Bot

## Features
- ✅ Verification (button click → verified role)
- 🔨 `/ban` — ban a member
- 🔇 `/mute` & `/unmute` — role-based mute
- ⏱️ `/timeout` — Discord native timeout with DM when it expires
- 📩 `/welcomedm` — custom DM sent to every new member
- 🖼️ `/embed` — build and send embeds as the bot
- 🎫 `/ticketpanel` — ticket panel with optional categories, reason modal, HTML transcript on close
- 🎬 `/watch` — embed Twitter/X, YouTube, TikTok links
- ⚙️ `/settings` — configure roles/channels without editing .env

---

## Setup

### 1. Clone / copy the bot to your VPS

### 2. Install dependencies
```bash
cd discord-bot
npm install
```

### 3. Create your .env file
```bash
cp .env.example .env
nano .env
```
Fill in all the values. Here's where to find them:
- **DISCORD_TOKEN** → Discord Developer Portal → Your App → Bot → Token
- **CLIENT_ID** → Discord Developer Portal → Your App → General Information → Application ID
- **GUILD_ID** → Right-click your server in Discord → Copy Server ID (enable Developer Mode in settings first)
- **VERIFIED_ROLE_ID** → Right-click the role in Server Settings → Copy Role ID
- **MUTED_ROLE_ID** → Same as above for your Muted role
- **TICKET_CATEGORY_ID** → Right-click a category in your channel list → Copy Category ID
- **TICKET_STAFF_ROLE_IDS** → Copy Role ID of your staff/mod role
- **TRANSCRIPT_LOG_CHANNEL_ID** → Right-click a channel → Copy Channel ID

### 4. Set up the Muted role
In your Discord server:
1. Create a role called "Muted"
2. For **every text channel** → Edit Channel → Permissions → Add "Muted" → Deny **Send Messages**
3. Or use a bot like **Mee6** to automatically apply deny perms to all channels
4. Put the Muted role ID in `.env`

### 5. Bot permissions
When inviting your bot, make sure it has:
- Manage Roles
- Manage Channels
- Ban Members
- Moderate Members (for timeout)
- Send Messages
- Read Message History
- Embed Links
- Attach Files

In your server, the bot's **highest role must be above** the Muted role and any role it needs to assign.

### 6. Enable Privileged Gateway Intents
Go to Discord Developer Portal → Your App → Bot → scroll to **Privileged Gateway Intents**:
- ✅ Server Members Intent
- ✅ Message Content Intent

### 7. Deploy slash commands
```bash
npm run deploy
```
This only needs to run once (or whenever you add new commands). Commands appear in your server within seconds.

### 8. Start the bot
```bash
npm start
```

For permanent running on your VPS use PM2:
```bash
npm install -g pm2
pm2 start src/index.js --name discord-bot
pm2 save
pm2 startup
```

---

## Command Reference

| Command | Description |
|---|---|
| `/ban @member [reason]` | Ban a member |
| `/mute @member [reason]` | Apply Muted role |
| `/unmute @member` | Remove Muted role |
| `/timeout @member 10m [reason]` | Time out (10m, 2h, 1d, etc.) |
| `/welcomedm <message>` | Set join DM. Use `{user}` `{username}` `{server}` |
| `/embed [#channel]` | Open embed builder modal |
| `/verifysetup [#channel]` | Post verification panel |
| `/ticketpanel [#channel] [categories] [title] [description]` | Post ticket panel |
| `/watch <link>` | Embed Twitter/X, YouTube, or TikTok link |
| `/settings` | Configure roles and channels |

### Ticket Panel Examples
Single button (no categories):
```
/ticketpanel #support title:Open a Ticket description:Click below for help.
```

With categories:
```
/ticketpanel #support categories:General Enquiry, Billing, Bug Report
```

---

## Twitter/X note
X (Twitter) has a broken video embed API. The bot uses **fxtwitter.com** as a community fix service — this means the video/image preview renders correctly in Discord. This is the same approach used by most popular embed bots.
