const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getSettings } = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Mute a member indefinitely using the Muted role')
    .addUserOption(opt => opt.setName('member').setDescription('Member to mute').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for the mute').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const target = interaction.options.getUser('member');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!member) return interaction.reply({ content: 'Member not found.', ephemeral: true });

    const settings = getSettings(interaction.guild.id);
    const mutedRoleId = settings.muted_role_id || process.env.MUTED_ROLE_ID;
    if (!mutedRoleId) {
      return interaction.reply({ content: 'No Muted role configured. Set MUTED_ROLE_ID in .env or use /settings.', ephemeral: true });
    }
    const role = interaction.guild.roles.cache.get(mutedRoleId);
    if (!role) return interaction.reply({ content: 'Configured Muted role no longer exists.', ephemeral: true });

    await member.roles.add(role, reason);

    const embed = new EmbedBuilder()
      .setColor(0xF39C12)
      .setTitle('Member Muted')
      .addFields(
        { name: 'Member', value: `${target.tag} (${target.id})` },
        { name: 'Moderator', value: `${interaction.user.tag}` },
        { name: 'Reason', value: reason }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
