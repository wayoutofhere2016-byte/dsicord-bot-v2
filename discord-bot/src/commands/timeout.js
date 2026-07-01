const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { db } = require('../database');

// Parse durations like 10m, 2h, 1d, 30s
function parseDuration(str) {
  const match = /^(\d+)([smhd])$/.exec(str.trim());
  if (!match) return null;
  const num = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return num * multipliers[unit];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Time out a member for a set duration; they get DMed when it expires')
    .addUserOption(opt => opt.setName('member').setDescription('Member to time out').setRequired(true))
    .addStringOption(opt => opt.setName('duration').setDescription('e.g. 10m, 2h, 1d (max 28d)').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for the timeout').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const target = interaction.options.getUser('member');
    const durationStr = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    const ms = parseDuration(durationStr);
    if (!ms || ms > 28 * 86400000) {
      return interaction.reply({ content: 'Invalid duration. Use formats like 10m, 2h, 1d (max 28d).', ephemeral: true });
    }

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!member) return interaction.reply({ content: 'Member not found.', ephemeral: true });
    if (!member.moderatable) {
      return interaction.reply({ content: 'I cannot time out this member (check role hierarchy / my permissions).', ephemeral: true });
    }

    await member.timeout(ms, reason);

    const expiresAt = Date.now() + ms;
    db.prepare('INSERT INTO timeouts (guild_id, user_id, expires_at, notified) VALUES (?, ?, ?, 0)')
      .run(interaction.guild.id, target.id, expiresAt);

    const embed = new EmbedBuilder()
      .setColor(0xF1C40F)
      .setTitle('Member Timed Out')
      .addFields(
        { name: 'Member', value: `${target.tag} (${target.id})` },
        { name: 'Duration', value: durationStr },
        { name: 'Moderator', value: `${interaction.user.tag}` },
        { name: 'Reason', value: reason }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
