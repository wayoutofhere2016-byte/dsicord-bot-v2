require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { db } = require('./database');
const { buildTranscript } = require('./utils/transcript');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel]
});

// Load commands
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
  const command = require(path.join(commandsPath, file));
  client.commands.set(command.data.name, command);
  console.log(`Loaded command: ${command.data.name}`);
}

// Load events
const eventsPath = path.join(__dirname, 'events');
for (const file of fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'))) {
  const event = require(path.join(eventsPath, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
  console.log(`Loaded event: ${event.name}`);
}

// ---- Timeout expiry DM checker ----
// Runs every 30 seconds. When a timeout expires, DM the user.
setInterval(async () => {
  const expired = db.prepare(
    'SELECT * FROM timeouts WHERE expires_at <= ? AND notified = 0'
  ).all(Date.now());

  for (const row of expired) {
    try {
      const user = await client.users.fetch(row.user_id);
      const guild = client.guilds.cache.get(row.guild_id);
      const guildName = guild ? guild.name : 'the server';
      await user.send(`Your timeout in **${guildName}** has expired. You can now send messages again.`);
    } catch {
      // User has DMs closed - ignore silently.
    }
    db.prepare('UPDATE timeouts SET notified = 1 WHERE id = ?').run(row.id);
  }
}, 30_000);

// ---- Ticket inactivity checker ----
// Checks every 5 minutes.
// After 12h of no messages  → warn in the ticket channel + DM the opener.
// After 15h (12h + 3h grace) and still warned → auto-close the ticket.
const INACTIVITY_WARN_MS  = 12 * 60 * 60 * 1000; // 12 hours
const INACTIVITY_CLOSE_MS = 15 * 60 * 60 * 1000; // 15 hours

setInterval(async () => {
  const now = Date.now();
  const { getSettings } = require('./database');

  // --- Auto-close tickets that were warned and still no response after 3h grace ---
  const toClose = db.prepare(`
    SELECT * FROM tickets
    WHERE status = 'open'
      AND inactivity_warned = 1
      AND last_activity <= ?
  `).all(now - INACTIVITY_CLOSE_MS);

  for (const ticket of toClose) {
    try {
      const guild = client.guilds.cache.get(ticket.guild_id);
      if (!guild) continue;
      const channel = guild.channels.cache.get(ticket.channel_id);
      if (!channel) continue;

      db.prepare("UPDATE tickets SET status = 'closed', closed_at = ?, closed_by = ? WHERE channel_id = ?")
        .run(now, client.user.id, ticket.channel_id);

      const transcriptAttachment = await buildTranscript(channel);

      // Log transcript
      const settings = getSettings(guild.id);
      const logChannelId = settings.transcript_log_channel_id || process.env.TRANSCRIPT_LOG_CHANNEL_ID;
      if (logChannelId) {
        const logChannel = guild.channels.cache.get(logChannelId);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setColor(0xE74C3C)
            .setTitle('Ticket Auto-Closed (Inactivity)')
            .addFields(
              { name: 'Channel', value: `#${channel.name}` },
              { name: 'Opened by', value: `<@${ticket.opener_id}>` },
              { name: 'Reason', value: 'No response after inactivity warning' }
            )
            .setTimestamp();
          await logChannel.send({ embeds: [logEmbed], files: [transcriptAttachment] });
        }
      }

      // DM opener with transcript
      try {
        const opener = await client.users.fetch(ticket.opener_id);
        await opener.send({
          content: `Your ticket in **${guild.name}** was automatically closed due to inactivity. Transcript attached.`,
          files: [transcriptAttachment]
        });
      } catch { /* DMs closed */ }

      await channel.send('⏰ This ticket has been automatically closed due to inactivity.');
      await new Promise(r => setTimeout(r, 3000));
      await channel.delete().catch(() => {});
    } catch (err) {
      console.error('Auto-close error:', err);
    }
  }

  // --- Warn tickets inactive for 12h that haven't been warned yet ---
  const toWarn = db.prepare(`
    SELECT * FROM tickets
    WHERE status = 'open'
      AND inactivity_warned = 0
      AND last_activity <= ?
  `).all(now - INACTIVITY_WARN_MS);

  for (const ticket of toWarn) {
    try {
      const guild = client.guilds.cache.get(ticket.guild_id);
      if (!guild) continue;
      const channel = guild.channels.cache.get(ticket.channel_id);
      if (!channel) continue;

      // Mark warned immediately so we don't double-send on the next interval
      db.prepare('UPDATE tickets SET inactivity_warned = 1 WHERE channel_id = ?')
        .run(ticket.channel_id);

      const inactiveMs = now - ticket.last_activity;
      const hours   = Math.floor(inactiveMs / 3_600_000);
      const minutes = Math.floor((inactiveMs % 3_600_000) / 60_000);

      const embed = new EmbedBuilder()
        .setColor(0xF39C12)
        .setTitle('⏳ Ticket Inactivity Warning')
        .setDescription(
          `Your ticket in **${guild.name}** has been inactive for **${hours} hours, ${minutes} minutes** and will be automatically closed in **3 hours** if no response is received.\n\nIf you respond to the ticket, the automatic closure will be cancelled.`
        )
        .setTimestamp();

      const viewButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('View Ticket')
          .setStyle(ButtonStyle.Link)
          .setURL(`https://discord.com/channels/${guild.id}/${channel.id}`)
      );

      // Post inside the ticket (mention the opener)
      await channel.send({ content: `<@${ticket.opener_id}>`, embeds: [embed], components: [viewButton] });

      // DM the opener
      try {
        const opener = await client.users.fetch(ticket.opener_id);
        await opener.send({ embeds: [embed], components: [viewButton] });
      } catch { /* DMs closed - ignore */ }

    } catch (err) {
      console.error('Inactivity warning error:', err);
    }
  }
}, 5 * 60 * 1000); // every 5 minutes

client.login(process.env.DISCORD_TOKEN);
