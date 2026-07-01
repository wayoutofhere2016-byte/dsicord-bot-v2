const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { db } = require('../database');

// Initialize reviews table
db.exec(`
CREATE TABLE IF NOT EXISTS ticket_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT,
  opener_id TEXT,
  channel_name TEXT,
  stars INTEGER,
  feedback TEXT,
  created_at INTEGER
);
`);

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reviews')
    .setDescription('View recent ticket reviews')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const reviews = db.prepare(`
      SELECT * FROM ticket_reviews
      WHERE guild_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `).all(interaction.guild.id);

    if (!reviews.length) {
      return interaction.reply({ content: 'No reviews yet.', ephemeral: true });
    }

    const stars = n => '⭐'.repeat(n) + '☆'.repeat(5 - n);

    const embed = new EmbedBuilder()
      .setColor(0xF1C40F)
      .setTitle('📋 Recent Ticket Reviews')
      .setDescription(reviews.map(r =>
        `${stars(r.stars)} — <@${r.opener_id}>\n${r.feedback ? `*"${r.feedback}"*` : '*No written feedback*'}\n<t:${Math.floor(r.created_at / 1000)}:R>`
      ).join('\n\n'))
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
